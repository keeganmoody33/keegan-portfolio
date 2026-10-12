/**
 * Dry extras FIND on lf:preview:. Holds lf:preview:crate:enrich:lock:v1 with
 * heartbeat. Calls MusicBrainz extras. Does not setPressing / setRecording.
 * Asserts lf:preview: before any write and aborts on unprefixed lf:.
 * Refuses --prod / --apply / --new-series.
 *
 *   npm run crate:search-extras-find
 */
import {
  ENRICH_LOCK_SECONDS,
  TRACK_LEVEL_ANNOTATE_CAP,
  TRACK_LEVEL_EXTRAS_ANNOTATE_RESERVE,
  createEnrichLockHeartbeat,
} from '../lib/crate/enrich.ts'
import { isPlayableOccurrence } from '../lib/crate/lifecycle.ts'
import {
  DURATION_SIDECAR_MS,
  destinationIsLive,
  durationDeltaMs,
  isDjMixDisambiguation,
  promoteVersionContradicts,
  recordingHasSampleMaterial,
  searchVersionFit,
  songTitle,
  titlesSimilar,
} from '../lib/crate/match.ts'
import {
  MUSICBRAINZ_RETRY_AFTER_CAP_MS,
  createMusicBrainzClient,
  isMusicBrainzRateLimitError,
} from '../lib/crate/musicbrainz.ts'
import { isRecordingOrReleaseSampleLink } from '../lib/crate/research.ts'
import {
  EXTRAS_TYPICAL_REQUESTS_PER_TRACK,
  EXTRAS_WORST_REQUESTS_PER_TRACK,
  countPressingMapLinks,
  fetchIsrcHits,
  fetchSecondQueryHits,
  fetchWorkBrowseHits,
  filterExtraSearchHits,
  filterWorkBrowseHits,
  liveStudioCompatible,
  projectExtrasRequestCost,
  sumTotals,
  type SearchExtrasDest,
} from '../lib/crate/search-extras.ts'
import {
  crateRedisKeys,
  getDefaultCrateStore,
  selectEnrichLockToken,
} from '../lib/crate/store.ts'
import type { SampleLink, StoredPressing, StoredRecording } from '../lib/crate/types.ts'
import {
  createUpstashRedis,
  isProductionRedisNamespace,
  REDIS_READ_CACHE,
  resolveRedisRestConfig,
} from '../lib/discogs-store.ts'

const LIVE_PROD_LINKS = 323
const PREVIEW_LOCK = 'lf:preview:crate:enrich:lock:v1'
const PREVIEW_PREFIX = 'lf:preview:'

class BudgetExceededError extends Error {
  readonly mbRequests: number
  readonly stopAt: number
  constructor(mbRequests: number, stopAt: number) {
    super(`MB requests ${mbRequests} exceeded 1.5x estimate ${stopAt}`)
    this.name = 'BudgetExceededError'
    this.mbRequests = mbRequests
    this.stopAt = stopAt
  }
}

if (process.argv.includes('--prod') || process.argv.includes('--apply')) {
  console.error('crate-search-extras-find is preview-prefix dry FIND; refused --prod/--apply')
  process.exit(1)
}
if (process.argv.includes('--new-series')) {
  console.error('refused --new-series')
  process.exit(1)
}

const env = process.env
if (isProductionRedisNamespace(env)) {
  console.error('refused production Redis namespace')
  process.exit(1)
}

function assertPreviewWriteKey(key: string): string {
  if (key.startsWith('lf:') && !key.startsWith(PREVIEW_PREFIX)) {
    throw new Error(`abort: unprefixed lf: write ${key}`)
  }
  if (!key.startsWith(PREVIEW_PREFIX)) {
    throw new Error(`abort: expected ${PREVIEW_PREFIX} key, got ${key}`)
  }
  return key
}

const keys = crateRedisKeys(env)
if (keys.prefix !== PREVIEW_PREFIX) {
  console.error(`expected ${PREVIEW_PREFIX} prefix, got ${keys.prefix}`)
  process.exit(1)
}
try {
  assertPreviewWriteKey(keys.prefix)
  assertPreviewWriteKey(keys.enrichLock)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
if (keys.enrichLock !== PREVIEW_LOCK) {
  console.error(`expected lock ${PREVIEW_LOCK}, got ${keys.enrichLock}`)
  process.exit(1)
}

const store = getDefaultCrateStore(env)
const config = resolveRedisRestConfig(env)
if (!store || !config) {
  console.error('no crate store (KV_REST_API_URL / KV_REST_API_TOKEN missing)')
  process.exit(1)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withMbRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof BudgetExceededError) throw error
      if (!isMusicBrainzRateLimitError(error) || attempt === 7) throw error
      const wait = Math.min(Math.max(error.retryAfterMs, 1000), MUSICBRAINZ_RETRY_AFTER_CAP_MS)
      await sleep(wait)
    }
  }
  throw new Error('MusicBrainz rate limited after retries')
}

function linkKey(direction: 'sample_of' | 'sampled_by', link: SampleLink): string {
  return `${direction}:${link.mbid || link.sourceUrl}`
}

function mapLinkKeys(pressing: StoredPressing): Set<string> {
  const onMap = new Set<string>()
  for (const recording of Object.values(pressing.recordings)) {
    for (const link of recording.samplesFrom.filter(isRecordingOrReleaseSampleLink)) {
      onMap.add(linkKey('sample_of', link))
    }
    for (const link of recording.sampledIn.filter(isRecordingOrReleaseSampleLink)) {
      onMap.add(linkKey('sampled_by', link))
    }
  }
  return onMap
}

function sampleRows(links: SampleLink[]): Array<{ title: string; artist: string; mbid: string }> {
  return links.filter(isRecordingOrReleaseSampleLink).map((link) => ({
    title: link.title,
    artist: link.artist,
    mbid: link.mbid,
  }))
}

type FoundRow = {
  releaseId: number
  albumTitle: string
  position: string
  destTitle: string
  destDurationMs: number | null
  destMbid: string
  destLengthMs: number | null
  extraMbid: string
  extraTitle: string
  extraLengthMs: number | null
  extraDisambiguation?: string
  lengthDeltaMs: number | null
  via: 'second' | 'isrc' | 'work'
  alreadyOnMap: boolean
  extraIsDestPick: boolean
  newSampleOf: number
  newSampledBy: number
  newLinks: number
  sampleOf: Array<{ title: string; artist: string; mbid: string }>
  sampledBy: Array<{ title: string; artist: string; mbid: string }>
  audit: {
    pass: boolean
    relOnExactRecording: boolean
    sameSong: boolean
    versionOk: boolean
    knownLengthWithin5s: boolean
    flags: string[]
  }
}

function auditRow(
  row: Omit<FoundRow, 'audit'>,
  dest: SearchExtrasDest,
  discogs: { artist: string; title: string; durationMs: number | null }
): FoundRow['audit'] {
  const flags: string[] = []
  const relOnExactRecording =
    row.sampleOf.length + row.sampledBy.length > 0 && row.extraMbid !== row.destMbid
  if (!relOnExactRecording) flags.push('rel_not_on_distinct_extra_recording')
  const sameSong =
    titlesSimilar(discogs.title, row.extraTitle) ||
    Boolean(songTitle(discogs.title) && songTitle(row.extraTitle) === songTitle(discogs.title))
  if (!sameSong) flags.push('different_song')
  const versionFit = searchVersionFit(discogs.title, row.extraTitle)
  const versionOk = versionFit !== 'wrong' && !promoteVersionContradicts(discogs.title, row.extraTitle)
  if (versionFit === 'wrong') flags.push('searchVersionFit_wrong')
  if (promoteVersionContradicts(discogs.title, row.extraTitle)) flags.push('vocal_instrumental_or_version')
  if (isDjMixDisambiguation(row.extraDisambiguation)) flags.push('dj_mix')
  if (!liveStudioCompatible(dest, {
    mbid: row.extraMbid,
    title: row.extraTitle,
    artist: discogs.artist,
    lengthMs: row.extraLengthMs,
    disambiguation: row.extraDisambiguation,
  })) {
    flags.push('live_studio')
  }
  if (destinationIsLive({ albumTitle: row.albumTitle, trackTitle: row.destTitle }) === false) {
    const album = row.albumTitle.toLowerCase()
    if (album.includes('stayin') && album.includes('alive')) flags.push('trap_stayin_alive_not_live_dest')
    if (/alive 2007/i.test(row.albumTitle)) flags.push('trap_alive_2007_not_live_dest')
  }
  if (/^alive!?$/i.test(row.albumTitle.replace(/\s+/g, ' ').trim()) === false && /alive!/i.test(row.albumTitle)) {
    flags.push('album_alive_token')
  }
  const knownLengthWithin5s =
    row.destDurationMs != null &&
    row.extraLengthMs != null &&
    (row.lengthDeltaMs == null || row.lengthDeltaMs <= DURATION_SIDECAR_MS)
  if (!knownLengthWithin5s) flags.push('unknown_or_far_length')
  if (row.extraIsDestPick) flags.push('exemption_stored_pick_self_confirm')
  const trapTitles = [
    { re: /clubstar/i, flag: 'trap_radio_edit_clubstar' },
    { re: /bourgié|bourgie/i, flag: 'trap_bourgie_vocal_instrumental' },
    { re: /black diamond/i, flag: 'trap_black_diamond_remix' },
    { re: /hotter than hell/i, flag: 'trap_hth_live_studio' },
  ]
  for (const trap of trapTitles) {
    if (trap.re.test(row.destTitle) || trap.re.test(row.extraTitle)) flags.push(trap.flag)
  }
  return {
    pass:
      relOnExactRecording &&
      sameSong &&
      versionOk &&
      knownLengthWithin5s &&
      !flags.includes('dj_mix') &&
      !flags.includes('live_studio') &&
      !flags.includes('exemption_stored_pick_self_confirm'),
    relOnExactRecording,
    sameSong,
    versionOk,
    knownLengthWithin5s,
    flags,
  }
}

const redis = createUpstashRedis(config, { cache: REDIS_READ_CACHE })
const match = keys.pressing(1).replace('1', '*')
const ids = new Set<number>()
let cursor = '0'
do {
  const scanned = await redis.scan(cursor, { match, count: 200 })
  const next = Array.isArray(scanned) ? scanned[0] : 0
  const batch = Array.isArray(scanned) ? scanned[1] ?? [] : []
  cursor = String(next)
  for (const key of batch) {
    if (typeof key !== 'string') continue
    if (key.includes(':draft:')) continue
    const foundKey = /crate:pressing:(\d+):v1$/.exec(key)
    if (!foundKey) continue
    const id = Number.parseInt(foundKey[1] ?? '', 10)
    if (Number.isInteger(id) && id > 0) ids.add(id)
  }
} while (cursor !== '0')

const pressings: StoredPressing[] = []
for (const id of [...ids].sort((a, b) => a - b)) {
  const pressing = await store.getPressing(id)
  if (pressing) pressings.push(pressing)
}

const currentPreview = sumTotals(pressings.map(countPressingMapLinks))
const projectedCost = projectExtrasRequestCost(pressings)
const eligibleE = projectedCost.extrasEligibleTracks
const baseRequests = 0
const estimate = baseRequests + EXTRAS_TYPICAL_REQUESTS_PER_TRACK * eligibleE
const plan = baseRequests + EXTRAS_WORST_REQUESTS_PER_TRACK * eligibleE
const stopAt = Math.ceil(estimate * 1.5)

assertPreviewWriteKey(keys.enrichLock)
const token = selectEnrichLockToken()
const locked = await store.acquireEnrichLock(ENRICH_LOCK_SECONDS, token)
if (!locked) {
  console.error('preview enrich lock not free; refused second writer')
  process.exit(1)
}

const heartbeat = createEnrichLockHeartbeat(store, token, ENRICH_LOCK_SECONDS, Date.now)
const mb = createMusicBrainzClient({
  onRequest: async () => {
    if (mb.requestCount > stopAt) throw new BudgetExceededError(mb.requestCount, stopAt)
    assertPreviewWriteKey(keys.enrichLock)
    return heartbeat()
  },
})
const extraProbeCap = Math.max(0, TRACK_LEVEL_ANNOTATE_CAP - TRACK_LEVEL_EXTRAS_ANNOTATE_RESERVE)
const found: FoundRow[] = []
let eligibleVisited = 0
let extrasSecond = 0
let extrasIsrc = 0
let extrasWork = 0
let stoppedOnError: string | null = null
let stoppedOnBudget = false

async function probeExtras(
  hits: ReturnType<typeof filterExtraSearchHits>,
  destRecording: StoredRecording,
  via: FoundRow['via'],
  pressing: StoredPressing,
  track: StoredPressing['tracks'][number],
  discogs: { artist: string; title: string; durationMs: number | null },
  dest: SearchExtrasDest
): Promise<boolean> {
  const seen = new Set<string>([destRecording.mbid])
  let probed = 0
  for (const hit of hits) {
    if (seen.has(hit.mbid)) continue
    seen.add(hit.mbid)
    if (probed >= extraProbeCap) break
    probed += 1
    const doc = await withMbRetry(() => mb.getRecording(hit.mbid))
    if (!doc) continue
    if (doc.isrcs?.length) hit.isrcs = doc.isrcs
    if (!recordingHasSampleMaterial(doc)) continue
    const onMap = mapLinkKeys(pressing)
    const newFrom = doc.samplesFrom.filter(
      (link) => isRecordingOrReleaseSampleLink(link) && !onMap.has(linkKey('sample_of', link))
    )
    const newIn = doc.sampledIn.filter(
      (link) => isRecordingOrReleaseSampleLink(link) && !onMap.has(linkKey('sampled_by', link))
    )
    const row = {
      releaseId: pressing.releaseId,
      albumTitle: pressing.facts.title,
      position: track.position,
      destTitle: track.title,
      destDurationMs: track.durationMs,
      destMbid: destRecording.mbid,
      destLengthMs: destRecording.lengthMs ?? null,
      extraMbid: doc.mbid,
      extraTitle: doc.title,
      extraLengthMs: doc.lengthMs ?? hit.lengthMs,
      ...(hit.disambiguation ? { extraDisambiguation: hit.disambiguation } : {}),
      lengthDeltaMs: durationDeltaMs(discogs.durationMs, doc.lengthMs ?? hit.lengthMs),
      via,
      alreadyOnMap: Boolean(pressing.recordings[doc.mbid]),
      extraIsDestPick: doc.mbid === destRecording.mbid,
      newSampleOf: newFrom.length,
      newSampledBy: newIn.length,
      newLinks: newFrom.length + newIn.length,
      sampleOf: sampleRows(doc.samplesFrom),
      sampledBy: sampleRows(doc.sampledIn),
    }
    found.push({ ...row, audit: auditRow(row, dest, discogs) })
    return true
  }
  return false
}

try {
  for (const pressing of pressings) {
    const albumTitle = pressing.facts.title
    const artist = pressing.facts.artist
    for (const track of pressing.tracks) {
      if (!isPlayableOccurrence(track)) continue
      const mbid = track.recording.mbid
      if (!mbid) continue
      const destRecording = pressing.recordings[mbid]
      if (!destRecording || recordingHasSampleMaterial(destRecording)) continue
      if (mb.requestCount > stopAt) throw new BudgetExceededError(mb.requestCount, stopAt)
      eligibleVisited += 1
      const discogs = {
        artist: (track.artist ?? '').trim() || artist,
        title: track.title,
        durationMs: track.durationMs,
      }
      const dest: SearchExtrasDest = {
        albumTitle,
        trackTitle: track.title,
      }
      const pickHit = {
        mbid: destRecording.mbid,
        title: destRecording.title,
        artist: destRecording.artist,
        lengthMs: destRecording.lengthMs ?? null,
        score: 100,
        hasSamples: false as const,
      }
      extrasSecond += 1
      const second = filterExtraSearchHits(
        await withMbRetry(() => fetchSecondQueryHits(mb, discogs)),
        discogs,
        dest
      )
      if (await probeExtras(second, destRecording, 'second', pressing, track, discogs, dest)) {
        continue
      }
      const afterSecond = [...(second[0] ? [second[0]] : []), pickHit]
      const isrcHits = filterExtraSearchHits(
        await withMbRetry(() => fetchIsrcHits(mb, afterSecond)),
        discogs,
        dest
      )
      if (isrcHits.length > 0) extrasIsrc += 1
      if (await probeExtras(isrcHits, destRecording, 'isrc', pressing, track, discogs, dest)) {
        continue
      }
      extrasWork += 1
      const workHits = filterWorkBrowseHits(
        await withMbRetry(() => fetchWorkBrowseHits(mb, discogs)),
        discogs,
        dest
      )
      await probeExtras(workHits, destRecording, 'work', pressing, track, discogs, dest)
    }
  }
} catch (error) {
  if (error instanceof BudgetExceededError) {
    stoppedOnBudget = true
    stoppedOnError = error.message
  } else {
    stoppedOnError = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  }
} finally {
  assertPreviewWriteKey(keys.enrichLock)
  await store.releaseEnrichLock(token)
}

const newLinks = found.reduce((sum, row) => sum + row.newLinks, 0)
const newSampleOf = found.reduce((sum, row) => sum + row.newSampleOf, 0)
const newSampledBy = found.reduce((sum, row) => sum + row.newSampledBy, 0)
const auditedPass = found.filter((row) => row.audit.pass)
const auditedFail = found.filter((row) => !row.audit.pass)
const report = {
  wrote: false,
  setPressing: false,
  setRecording: false,
  prefix: keys.prefix,
  lock: PREVIEW_LOCK,
  pressings: pressings.length,
  currentPreview,
  liveProdLinks: LIVE_PROD_LINKS,
  eligibleE,
  baseRequests,
  estimate,
  plan,
  stopAt,
  projectedCost,
  eligibleVisited,
  extrasSecond,
  extrasIsrc,
  extrasWork,
  mbRequests: mb.requestCount,
  foundTracks: found.length,
  newLinks,
  newSampleOf,
  newSampledBy,
  auditedPass: auditedPass.length,
  auditedFail: auditedFail.length,
  vsProd323: {
    previewNow: currentPreview.links,
    previewPlusNew: currentPreview.links + newLinks,
    prod: LIVE_PROD_LINKS,
    newVsProd: currentPreview.links + newLinks - LIVE_PROD_LINKS,
  },
  sidecarMs: DURATION_SIDECAR_MS,
  extraProbeCap,
  stoppedOnBudget,
  stoppedOnError,
  found,
}

console.log(JSON.stringify(report, null, 2))
if (stoppedOnError && !stoppedOnBudget) process.exit(1)
