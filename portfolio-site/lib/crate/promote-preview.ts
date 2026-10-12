/**
 * One-off copy of audited preview crate sidecars onto prod for the 23 gap
 * records. No MusicBrainz. No WhoSampled. Default is dry-run.
 *
 * Preview recordings attach to a prod track only when they pass the same
 * artist / song / version / duration / complete checks the crate uses now:
 * raw-credit artistsMatch, same songTitle, searchVersionFit (unmarked track
 * takes unmarked only; marked track takes the same marker or falls back to
 * the unmarked original), duration within DURATION_SIDECAR_MS when both
 * lengths are known, and recordingIsCompleteSidecar.
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { recordingIsCompleteSidecar } from './enrich.ts'
import { isPlayableOccurrence } from './lifecycle.ts'
import {
  artistsMatch,
  DURATION_SIDECAR_MS,
  hitFromStoredRecording,
  recordingHasSampleMaterial,
  searchVersionFit,
  songTitle,
  type SearchVersionFit,
} from './match.ts'
import { coalesceRecordingLengthMs } from './preserve.ts'
import { isRecordingOrReleaseSampleLink, mergeSampleLinks } from './research.ts'
import { crateRedisKeys, type CrateStore } from './store.ts'
import type { SampleLink, StoredPressing, StoredRecording, TrackOccurrence } from './types.ts'

export const GAP_RELEASE_IDS = [
  106712, 266650, 378994, 451558, 550972, 903960, 1575060, 1679157, 1930841, 3018422,
  3221873, 4217381, 4666933, 6625293, 6729400, 7482706, 10416361, 11449230, 11917223,
  13694938, 14851267, 21093352, 23467838,
] as const

export const MTUME_RELEASE_ID = 567894
export const MTUME_VOCAL_MBID = '1d890c2b-d330-40aa-8e41-07aaffe653b9'
export const JUICY_MBID = '181c0a32-07a7-4c47-b482-ba0dc31994f7'

export const PROD_BAR = 360
export const PREVIEW_BAR = 389

const REMIX_LIVE_EDIT_TOKENS = ['remix', 'live', 'edit', 'radio', 'club'] as const

export const PROD_NAMESPACE_ENV = {
  VERCEL_ENV: 'production',
  VERCEL_GIT_COMMIT_REF: 'main',
} as const

export const PREVIEW_NAMESPACE_ENV = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'preview',
} as const

export type EnvMap = Record<string, string | undefined>

export type PromoteMode = 'dry-run' | 'apply' | 'rollback'

export type PromoteArgs = {
  apply: boolean
  rollbackPath?: string
  backupPath?: string
  ids?: number[]
}

export type PromoteSnapshotEntry = {
  key: string
  value: string | null
}

export type PromoteSnapshot = {
  createdAt: string
  prefix: string
  keys: PromoteSnapshotEntry[]
}

export type PromoteRawStore = {
  getRaw(key: string): Promise<string | null>
  setRaw(key: string, value: string | null): Promise<void>
  scanKeys?(match: string): Promise<string[]>
}

export type SampleTotals = {
  links: number
  records: number
  sampleOf: number
  sampledBy: number
}

export type PromoteAddedLink = {
  source: 'sidecar-title' | 'sample-target'
  releaseId?: number
  direction: 'sample_of' | 'sampled_by'
  title: string
  artist: string
  mbid: string
  sourceUrl: string
  versionFlags: string[]
}

export type PromoteCopy = {
  releaseId: number
  mbid: string
  recordingTitle: string
  recordingArtist: string
  alreadyOnMap: boolean
  versionFit: SearchVersionFit
  matchedTracks: Array<{ position: string; title: string }>
  addedLinks: PromoteAddedLink[]
  borderline: string[]
}

export type PromoteSkip = {
  releaseId: number
  mbid: string
  title: string
  reason: string
}

export type PromoteRecordRow = {
  releaseId: number
  title: string
  artist: string
  currentProd: SampleTotals
  preview: SampleTotals
  projectedProd: SampleTotals
  copies: PromoteCopy[]
  skips: PromoteSkip[]
}

export type PromoteReport = {
  mode: PromoteMode
  prodPrefix: string
  previewPrefix: string
  wrote: boolean
  keys: string[]
  backupPath?: string
  restored?: string[]
  currentProd: SampleTotals
  currentPreview: SampleTotals
  projectedProd: SampleTotals
  vs360: number
  vs389: number
  records: PromoteRecordRow[]
  remixLiveEdit: PromoteAddedLink[]
  borderline: Array<{ releaseId: number; mbid: string; title: string; notes: string[] }>
  mtume: {
    releaseId: number
    inGapIds: boolean
    plannedPressingWrite: boolean
    vocalMbid: string
    juicyLinked: boolean
    sampledByMbids: string[]
  }
}

function uniquePositive(ids: Iterable<number>): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function parsePromoteArgs(argv: string[]): PromoteArgs {
  const args: PromoteArgs = { apply: false }
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]
    if (!raw) continue
    if (raw === '--apply') args.apply = true
    else if (raw === '--rollback') {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        throw new Error('--rollback requires a backup file path')
      }
      args.rollbackPath = next
      i += 1
    } else if (raw.startsWith('--rollback=')) {
      args.rollbackPath = raw.slice('--rollback='.length)
    } else if (raw === '--backup') {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        throw new Error('--backup requires a file path')
      }
      args.backupPath = next
      i += 1
    } else if (raw.startsWith('--backup=')) {
      args.backupPath = raw.slice('--backup='.length)
    } else if (raw.startsWith('--ids=')) {
      args.ids = raw
        .slice('--ids='.length)
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    }
  }
  if (args.apply && args.rollbackPath) {
    throw new Error('pass --apply or --rollback, not both')
  }
  return args
}

export function withProdNamespace(env: EnvMap = process.env): EnvMap {
  return { ...env, ...PROD_NAMESPACE_ENV }
}

export function withPreviewNamespace(env: EnvMap = process.env): EnvMap {
  return { ...env, ...PREVIEW_NAMESPACE_ENV }
}

export function assertPromotePrefixes(prodEnv: EnvMap, previewEnv: EnvMap): {
  prodPrefix: string
  previewPrefix: string
} {
  const prodPrefix = crateRedisKeys(prodEnv).prefix
  const previewPrefix = crateRedisKeys(previewEnv).prefix
  if (prodPrefix !== 'lf:') {
    throw new Error(`prod prefix must be lf: (got ${prodPrefix})`)
  }
  if (previewPrefix !== 'lf:preview:') {
    throw new Error(`preview prefix must be lf:preview: (got ${previewPrefix})`)
  }
  return { prodPrefix, previewPrefix }
}

export function isPromoteSidecarMatch(
  discogs: { artist: string; title: string; durationMs: number | null },
  hit: { title: string; artist: string; lengthMs: number | null }
): boolean {
  if (!artistsMatch(discogs.artist, hit.artist)) return false
  const discogsSong = songTitle(discogs.title)
  const hitSong = songTitle(hit.title)
  if (!discogsSong || discogsSong !== hitSong) return false
  if (searchVersionFit(discogs.title, hit.title) === 'wrong') return false
  if (discogs.durationMs != null && hit.lengthMs != null) {
    if (Math.abs(discogs.durationMs - hit.lengthMs) > DURATION_SIDECAR_MS) return false
  }
  return true
}

export function countRecordingLinks(recording: StoredRecording | null | undefined): {
  sampleOf: number
  sampledBy: number
  links: number
} {
  if (!recording) return { sampleOf: 0, sampledBy: 0, links: 0 }
  const sampleOf = recording.samplesFrom.filter(isRecordingOrReleaseSampleLink).length
  const sampledBy = recording.sampledIn.filter(isRecordingOrReleaseSampleLink).length
  return { sampleOf, sampledBy, links: sampleOf + sampledBy }
}

export function countPressingMapLinks(pressing: StoredPressing | null | undefined): SampleTotals {
  if (!pressing) return { links: 0, records: 0, sampleOf: 0, sampledBy: 0 }
  let sampleOf = 0
  let sampledBy = 0
  for (const recording of Object.values(pressing.recordings)) {
    const counts = countRecordingLinks(recording)
    sampleOf += counts.sampleOf
    sampledBy += counts.sampledBy
  }
  const links = sampleOf + sampledBy
  return { links, records: links > 0 ? 1 : 0, sampleOf, sampledBy }
}

export function sumTotals(rows: SampleTotals[]): SampleTotals {
  const summed: SampleTotals = { links: 0, records: 0, sampleOf: 0, sampledBy: 0 }
  for (const row of rows) {
    summed.links += row.links
    summed.records += row.records
    summed.sampleOf += row.sampleOf
    summed.sampledBy += row.sampledBy
  }
  return summed
}

function trackDiscogs(
  pressing: StoredPressing,
  track: TrackOccurrence
): { artist: string; title: string; durationMs: number | null } {
  return {
    artist: (track.artist ?? '').trim() || pressing.facts.artist,
    title: track.title,
    durationMs: track.durationMs,
  }
}

function versionFlags(title: string): string[] {
  const normalized = ` ${title.toLowerCase()} `
  return REMIX_LIVE_EDIT_TOKENS.filter((token) => new RegExp(`[^a-z]${token}[^a-z]`, 'i').test(normalized))
}

function linkIdentity(direction: 'sample_of' | 'sampled_by', link: SampleLink): string {
  return `${direction}\u001f${link.mbid || link.sourceUrl}`
}

function recordingLinkIdentities(recording: StoredRecording | null | undefined): Set<string> {
  const keys = new Set<string>()
  if (!recording) return keys
  for (const link of recording.samplesFrom.filter(isRecordingOrReleaseSampleLink)) {
    keys.add(linkIdentity('sample_of', link))
  }
  for (const link of recording.sampledIn.filter(isRecordingOrReleaseSampleLink)) {
    keys.add(linkIdentity('sampled_by', link))
  }
  return keys
}

function addedSampleLinks(
  from: StoredRecording | null | undefined,
  to: StoredRecording
): PromoteAddedLink[] {
  const have = recordingLinkIdentities(from)
  const added: PromoteAddedLink[] = []
  for (const link of to.samplesFrom.filter(isRecordingOrReleaseSampleLink)) {
    if (have.has(linkIdentity('sample_of', link))) continue
    added.push({
      source: 'sample-target',
      direction: 'sample_of',
      title: link.title,
      artist: link.artist,
      mbid: link.mbid,
      sourceUrl: link.sourceUrl,
      versionFlags: versionFlags(link.title),
    })
  }
  for (const link of to.sampledIn.filter(isRecordingOrReleaseSampleLink)) {
    if (have.has(linkIdentity('sampled_by', link))) continue
    added.push({
      source: 'sample-target',
      direction: 'sampled_by',
      title: link.title,
      artist: link.artist,
      mbid: link.mbid,
      sourceUrl: link.sourceUrl,
      versionFlags: versionFlags(link.title),
    })
  }
  return added
}

function mergePromoteRecording(
  prod: StoredRecording | null,
  preview: StoredRecording
): StoredRecording {
  if (!prod) return preview
  if (!recordingIsCompleteSidecar(prod) && recordingIsCompleteSidecar(preview)) {
    return {
      ...preview,
      samplesFrom: mergeSampleLinks(preview.samplesFrom, prod.samplesFrom),
      sampledIn: mergeSampleLinks(preview.sampledIn, prod.sampledIn),
      lengthMs: coalesceRecordingLengthMs(prod.lengthMs, preview.lengthMs),
    }
  }
  return {
    ...prod,
    samplesFrom: mergeSampleLinks(prod.samplesFrom, preview.samplesFrom),
    sampledIn: mergeSampleLinks(prod.sampledIn, preview.sampledIn),
    lengthMs: coalesceRecordingLengthMs(prod.lengthMs, preview.lengthMs),
  }
}

async function loadRecording(
  store: CrateStore,
  mapDoc: StoredRecording | undefined,
  mbid: string
): Promise<StoredRecording | null> {
  const redisDoc = await store.getRecording(mbid)
  if (!redisDoc && !mapDoc) return null
  if (!redisDoc) return mapDoc ?? null
  if (!mapDoc) return redisDoc
  return {
    ...redisDoc,
    samplesFrom: mergeSampleLinks(redisDoc.samplesFrom, mapDoc.samplesFrom),
    sampledIn: mergeSampleLinks(redisDoc.sampledIn, mapDoc.sampledIn),
    lengthMs: coalesceRecordingLengthMs(redisDoc.lengthMs, mapDoc.lengthMs),
  }
}

function matchingTracks(pressing: StoredPressing, recording: StoredRecording): TrackOccurrence[] {
  const hit = hitFromStoredRecording(recording, 100)
  return pressing.tracks.filter((track) => {
    if (!isPlayableOccurrence(track)) return false
    return isPromoteSidecarMatch(trackDiscogs(pressing, track), hit)
  })
}

function copyBorderline(
  recording: StoredRecording,
  fit: SearchVersionFit,
  matched: TrackOccurrence[]
): string[] {
  const notes: string[] = []
  if (fit === 'unmarked_fallback') notes.push('marked track fell back to unmarked original')
  if (recording.lengthMs == null) notes.push('recording length unknown')
  if (matched.some((track) => track.durationMs == null)) notes.push('track duration unknown')
  if (versionFlags(recording.title).length > 0) {
    notes.push(`recording title flags: ${versionFlags(recording.title).join(',')}`)
  }
  return notes
}

type PlannedWrite = {
  key: string
  kind: 'pressing' | 'recording'
  releaseId?: number
  mbid?: string
  pressing?: StoredPressing
  recording?: StoredRecording
}

function releaseIdFromPressingKey(key: string, prefix: string): number | null {
  const match = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}crate:pressing:(\\d+):v1$`
  ).exec(key)
  if (!match) return null
  const id = Number.parseInt(match[1] ?? '', 10)
  return Number.isInteger(id) && id > 0 ? id : null
}

async function pressingIdsForTotals(
  store: CrateStore,
  extra: number[],
  raw: PromoteRawStore | undefined,
  prefix: string
): Promise<number[]> {
  const seen = await store.getSeen()
  const backfill = await store.getBackfill()
  const scanned: number[] = []
  if (raw?.scanKeys) {
    const keys = await raw.scanKeys(`${prefix}crate:pressing:*:v1`)
    for (const key of keys) {
      const id = releaseIdFromPressingKey(key, prefix)
      if (id) scanned.push(id)
    }
  }
  return uniquePositive([...seen, ...(backfill?.settled ?? []), ...scanned, ...extra])
}

async function totalsFor(
  store: CrateStore,
  extra: number[],
  raw: PromoteRawStore | undefined,
  prefix: string
): Promise<SampleTotals> {
  const ids = await pressingIdsForTotals(store, extra, raw, prefix)
  const pressings = await store.getPressings(ids)
  return sumTotals([...pressings.values()].map((pressing) => countPressingMapLinks(pressing)))
}

async function juicyLinked(store: CrateStore): Promise<{
  juicyLinked: boolean
  sampledByMbids: string[]
}> {
  const pressing = await store.getPressing(MTUME_RELEASE_ID)
  const mapDoc = pressing?.recordings[MTUME_VOCAL_MBID]
  const recording = await loadRecording(store, mapDoc, MTUME_VOCAL_MBID)
  const sampledByMbids = (recording?.sampledIn ?? [])
    .filter(isRecordingOrReleaseSampleLink)
    .map((link) => link.mbid)
    .filter(Boolean)
  return {
    juicyLinked: sampledByMbids.includes(JUICY_MBID),
    sampledByMbids,
  }
}

export function memoryPromoteRawStore(
  store: {
    pressings: Record<number, StoredPressing>
    recordings: Record<string, StoredRecording>
  },
  env: EnvMap
): PromoteRawStore {
  const keys = crateRedisKeys(env)
  const pressingRe = new RegExp(`^${keys.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}crate:pressing:(\\d+):v1$`)
  const recordingRe = new RegExp(
    `^${keys.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}crate:recording:(.+):v1$`
  )
  return {
    async getRaw(key: string) {
      const pressing = pressingRe.exec(key)
      if (pressing) {
        const id = Number.parseInt(pressing[1] ?? '', 10)
        const doc = store.pressings[id]
        return doc ? JSON.stringify(doc) : null
      }
      const recording = recordingRe.exec(key)
      if (recording) {
        const mbid = recording[1] ?? ''
        const doc = store.recordings[mbid]
        return doc ? JSON.stringify(doc) : null
      }
      throw new Error(`unsupported promote key: ${key}`)
    },
    async setRaw(key: string, value: string | null) {
      const pressing = pressingRe.exec(key)
      if (pressing) {
        const id = Number.parseInt(pressing[1] ?? '', 10)
        if (value == null) delete store.pressings[id]
        else store.pressings[id] = JSON.parse(value) as StoredPressing
        return
      }
      const recording = recordingRe.exec(key)
      if (recording) {
        const mbid = recording[1] ?? ''
        if (value == null) delete store.recordings[mbid]
        else store.recordings[mbid] = JSON.parse(value) as StoredRecording
        return
      }
      throw new Error(`unsupported promote key: ${key}`)
    },
    async scanKeys(match: string) {
      const pattern = new RegExp(`^${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`)
      const found: string[] = []
      for (const id of Object.keys(store.pressings)) {
        const key = keys.pressing(Number(id))
        if (pattern.test(key)) found.push(key)
      }
      for (const mbid of Object.keys(store.recordings)) {
        const key = keys.recording(mbid)
        if (pattern.test(key)) found.push(key)
      }
      return found
    },
  }
}

export async function snapshotPromoteKeys(
  raw: PromoteRawStore,
  keys: string[],
  prefix: string
): Promise<PromoteSnapshot> {
  const entries: PromoteSnapshotEntry[] = []
  for (const key of keys) {
    entries.push({ key, value: await raw.getRaw(key) })
  }
  return { createdAt: new Date().toISOString(), prefix, keys: entries }
}

export async function restorePromoteSnapshot(
  raw: PromoteRawStore,
  snapshot: PromoteSnapshot
): Promise<string[]> {
  const restored: string[] = []
  for (const entry of snapshot.keys) {
    await raw.setRaw(entry.key, entry.value)
    restored.push(entry.key)
  }
  return restored
}

export function writePromoteSnapshotFile(path: string, snapshot: PromoteSnapshot): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(snapshot), { encoding: 'utf8', mode: 0o600 })
}

export function readPromoteSnapshotFile(path: string): PromoteSnapshot {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as PromoteSnapshot
  if (!parsed || parsed.prefix !== 'lf:' || !Array.isArray(parsed.keys)) {
    throw new Error(`invalid promote snapshot: ${path}`)
  }
  return parsed
}

function defaultBackupPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `/tmp/lf-secrets/crate-promote-preview-${stamp}.json`
}

async function planCopies(options: {
  prod: CrateStore
  preview: CrateStore
  prodKeys: ReturnType<typeof crateRedisKeys>
  ids: number[]
}): Promise<{
  records: PromoteRecordRow[]
  writes: PlannedWrite[]
  remixLiveEdit: PromoteAddedLink[]
  borderline: PromoteReport['borderline']
}> {
  const { prod, preview, prodKeys, ids } = options
  const records: PromoteRecordRow[] = []
  const writes: PlannedWrite[] = []
  const remixLiveEdit: PromoteAddedLink[] = []
  const borderline: PromoteReport['borderline'] = []
  const recordingWriteMbids = new Set<string>()

  for (const releaseId of ids) {
    const previewPressing = await preview.getPressing(releaseId)
    const prodPressing = await prod.getPressing(releaseId)
    if (!previewPressing || !prodPressing) {
      records.push({
        releaseId,
        title: previewPressing?.facts.title ?? prodPressing?.facts.title ?? '',
        artist: previewPressing?.facts.artist ?? prodPressing?.facts.artist ?? '',
        currentProd: countPressingMapLinks(prodPressing),
        preview: countPressingMapLinks(previewPressing),
        projectedProd: countPressingMapLinks(prodPressing),
        copies: [],
        skips: [
          {
            releaseId,
            mbid: '',
            title: '',
            reason: !previewPressing ? 'missing preview pressing' : 'missing prod pressing',
          },
        ],
      })
      continue
    }

    const nextRecordings: Record<string, StoredRecording> = { ...prodPressing.recordings }
    const copies: PromoteCopy[] = []
    const skips: PromoteSkip[] = []
    let mapChanged = false

    for (const [mbid, previewMapDoc] of Object.entries(previewPressing.recordings)) {
      const previewDoc = await loadRecording(preview, previewMapDoc, mbid)
      if (!previewDoc) continue
      if (!recordingIsCompleteSidecar(previewDoc)) {
        skips.push({ releaseId, mbid, title: previewDoc.title, reason: 'incomplete recording' })
        continue
      }
      const alreadyOnMap = Boolean(prodPressing.recordings[mbid])
      const matched = matchingTracks(prodPressing, previewDoc)
      if (!alreadyOnMap && matched.length === 0) {
        skips.push({ releaseId, mbid, title: previewDoc.title, reason: 'no matching prod track' })
        continue
      }
      const prodDoc = await loadRecording(prod, prodPressing.recordings[mbid], mbid)
      if (
        prodDoc &&
        recordingIsCompleteSidecar(prodDoc) &&
        countRecordingLinks(prodDoc).links > countRecordingLinks(previewDoc).links &&
        addedSampleLinks(prodDoc, previewDoc).length === 0 &&
        alreadyOnMap
      ) {
        skips.push({
          releaseId,
          mbid,
          title: previewDoc.title,
          reason: 'complete prod doc has more sample rels',
        })
        continue
      }
      const merged = mergePromoteRecording(prodDoc, previewDoc)
      const addedLinks = addedSampleLinks(prodPressing.recordings[mbid] ?? prodDoc, merged)
      const mapEntryChanged =
        !alreadyOnMap || JSON.stringify(nextRecordings[mbid] ?? null) !== JSON.stringify(merged)
      const redisNeedsWrite =
        !prodDoc || JSON.stringify({
          samplesFrom: prodDoc.samplesFrom,
          sampledIn: prodDoc.sampledIn,
          lengthMs: prodDoc.lengthMs ?? null,
        }) !== JSON.stringify({
          samplesFrom: merged.samplesFrom,
          sampledIn: merged.sampledIn,
          lengthMs: merged.lengthMs ?? null,
        })
      if (!mapEntryChanged && !redisNeedsWrite && addedLinks.length === 0) {
        skips.push({ releaseId, mbid, title: previewDoc.title, reason: 'already present' })
        continue
      }
      if (!recordingHasSampleMaterial(merged) && !alreadyOnMap) {
        skips.push({ releaseId, mbid, title: previewDoc.title, reason: 'no sample rels' })
        continue
      }

      nextRecordings[mbid] = merged
      if (mapEntryChanged) mapChanged = true
      const fit =
        matched[0] != null
          ? searchVersionFit(matched[0].title, previewDoc.title)
          : searchVersionFit(previewDoc.title, previewDoc.title)
      const notes = copyBorderline(previewDoc, fit, matched)
      copies.push({
        releaseId,
        mbid,
        recordingTitle: previewDoc.title,
        recordingArtist: previewDoc.artist,
        alreadyOnMap,
        versionFit: fit,
        matchedTracks: matched.map((track) => ({ position: track.position, title: track.title })),
        addedLinks,
        borderline: notes,
      })
      if (notes.length > 0) {
        borderline.push({ releaseId, mbid, title: previewDoc.title, notes })
      }
      for (const link of addedLinks) {
        if (link.versionFlags.length > 0) remixLiveEdit.push({ ...link, releaseId })
      }
      if (versionFlags(previewDoc.title).length > 0) {
        remixLiveEdit.push({
          source: 'sidecar-title',
          releaseId,
          direction: 'sampled_by',
          title: previewDoc.title,
          artist: previewDoc.artist,
          mbid: previewDoc.mbid,
          sourceUrl: `https://musicbrainz.org/recording/${previewDoc.mbid}`,
          versionFlags: versionFlags(previewDoc.title),
        })
      }
      if (redisNeedsWrite && !recordingWriteMbids.has(mbid)) {
        recordingWriteMbids.add(mbid)
        writes.push({
          key: prodKeys.recording(mbid),
          kind: 'recording',
          mbid,
          recording: merged,
        })
      }
    }

    const projected = countPressingMapLinks({ ...prodPressing, recordings: nextRecordings })
    if (mapChanged) {
      writes.push({
        key: prodKeys.pressing(releaseId),
        kind: 'pressing',
        releaseId,
        pressing: { ...prodPressing, recordings: nextRecordings },
      })
    }
    records.push({
      releaseId,
      title: prodPressing.facts.title,
      artist: prodPressing.facts.artist,
      currentProd: countPressingMapLinks(prodPressing),
      preview: countPressingMapLinks(previewPressing),
      projectedProd: projected,
      copies,
      skips,
    })
  }

  return { records, writes, remixLiveEdit, borderline }
}

export async function runPromotePreview(options: {
  prod: CrateStore
  preview: CrateStore
  prodEnv: EnvMap
  previewEnv: EnvMap
  ids?: number[]
  apply?: boolean
  rollbackPath?: string
  backupPath?: string
  raw?: PromoteRawStore
}): Promise<PromoteReport> {
  const { prodPrefix, previewPrefix } = assertPromotePrefixes(options.prodEnv, options.previewEnv)
  const prodKeys = crateRedisKeys(options.prodEnv)
  const ids = uniquePositive(options.ids ?? GAP_RELEASE_IDS)

  if (options.rollbackPath) {
    if (!options.raw) throw new Error('rollback needs a raw store')
    const snapshot = readPromoteSnapshotFile(options.rollbackPath)
    if (snapshot.prefix !== prodPrefix) {
      throw new Error(`snapshot prefix ${snapshot.prefix} does not match ${prodPrefix}`)
    }
    const restored = await restorePromoteSnapshot(options.raw, snapshot)
    const mtume = await juicyLinked(options.prod)
    const currentProd = await totalsFor(options.prod, ids, options.raw, prodPrefix)
    const currentPreview = await totalsFor(options.preview, ids, options.raw, previewPrefix)
    return {
      mode: 'rollback',
      prodPrefix,
      previewPrefix,
      wrote: true,
      keys: restored,
      backupPath: options.rollbackPath,
      restored,
      currentProd,
      currentPreview,
      projectedProd: currentProd,
      vs360: currentProd.links - PROD_BAR,
      vs389: currentProd.links - PREVIEW_BAR,
      records: [],
      remixLiveEdit: [],
      borderline: [],
      mtume: {
        releaseId: MTUME_RELEASE_ID,
        inGapIds: ids.includes(MTUME_RELEASE_ID),
        plannedPressingWrite: restored.includes(prodKeys.pressing(MTUME_RELEASE_ID)),
        vocalMbid: MTUME_VOCAL_MBID,
        ...mtume,
      },
    }
  }

  const planned = await planCopies({
    prod: options.prod,
    preview: options.preview,
    prodKeys,
    ids,
  })
  const keys = [...new Set(planned.writes.map((write) => write.key))].sort()
  const currentProd = await totalsFor(options.prod, ids, options.raw, prodPrefix)
  const currentPreview = await totalsFor(options.preview, ids, options.raw, previewPrefix)
  const gapCurrent = sumTotals(planned.records.map((row) => row.currentProd))
  const gapProjected = sumTotals(planned.records.map((row) => row.projectedProd))
  const projectedProd: SampleTotals = {
    links: currentProd.links - gapCurrent.links + gapProjected.links,
    records: currentProd.records - gapCurrent.records + gapProjected.records,
    sampleOf: currentProd.sampleOf - gapCurrent.sampleOf + gapProjected.sampleOf,
    sampledBy: currentProd.sampledBy - gapCurrent.sampledBy + gapProjected.sampledBy,
  }
  const mtume = await juicyLinked(options.prod)
  const plannedPressingWrite = keys.includes(prodKeys.pressing(MTUME_RELEASE_ID))

  if (!options.apply) {
    return {
      mode: 'dry-run',
      prodPrefix,
      previewPrefix,
      wrote: false,
      keys,
      currentProd,
      currentPreview,
      projectedProd,
      vs360: projectedProd.links - PROD_BAR,
      vs389: projectedProd.links - PREVIEW_BAR,
      records: planned.records,
      remixLiveEdit: planned.remixLiveEdit,
      borderline: planned.borderline,
      mtume: {
        releaseId: MTUME_RELEASE_ID,
        inGapIds: ids.includes(MTUME_RELEASE_ID),
        plannedPressingWrite,
        vocalMbid: MTUME_VOCAL_MBID,
        ...mtume,
      },
    }
  }

  if (!options.raw) throw new Error('--apply needs a raw store for the backup snapshot')
  const backupPath = options.backupPath ?? defaultBackupPath()
  const snapshot = await snapshotPromoteKeys(options.raw, keys, prodPrefix)
  writePromoteSnapshotFile(backupPath, snapshot)
  for (const write of planned.writes) {
    if (write.kind === 'recording' && write.recording) {
      await options.raw.setRaw(write.key, JSON.stringify(write.recording))
    }
  }
  for (const write of planned.writes) {
    if (write.kind === 'pressing' && write.pressing) {
      await options.raw.setRaw(write.key, JSON.stringify(write.pressing))
    }
  }
  const afterProd = await totalsFor(options.prod, ids, options.raw, prodPrefix)
  return {
    mode: 'apply',
    prodPrefix,
    previewPrefix,
    wrote: true,
    keys,
    backupPath,
    currentProd,
    currentPreview,
    projectedProd: afterProd,
    vs360: afterProd.links - PROD_BAR,
    vs389: afterProd.links - PREVIEW_BAR,
    records: planned.records,
    remixLiveEdit: planned.remixLiveEdit,
    borderline: planned.borderline,
    mtume: {
      releaseId: MTUME_RELEASE_ID,
      inGapIds: ids.includes(MTUME_RELEASE_ID),
      plannedPressingWrite,
      vocalMbid: MTUME_VOCAL_MBID,
      ...(await juicyLinked(options.prod)),
    },
  }
}

export async function upstashPromoteRawStore(config: {
  url: string
  token: string
}): Promise<PromoteRawStore> {
  const endpoint = config.url.replace(/\/$/, '')
  async function command(args: string[]): Promise<unknown> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    })
    if (!response.ok) {
      throw new Error(`upstash ${args[0]} failed: ${response.status}`)
    }
    const body = (await response.json()) as { result?: unknown; error?: string }
    if (body.error) throw new Error(body.error)
    return body.result ?? null
  }
  return {
    async getRaw(key: string) {
      const result = await command(['GET', key])
      if (result == null) return null
      return typeof result === 'string' ? result : JSON.stringify(result)
    },
    async setRaw(key: string, value: string | null) {
      if (value == null) {
        await command(['DEL', key])
        return
      }
      await command(['SET', key, value])
    },
    async scanKeys(match: string) {
      const found: string[] = []
      let cursor = '0'
      do {
        const result = await command(['SCAN', cursor, 'MATCH', match, 'COUNT', '100'])
        const row = Array.isArray(result) ? result : []
        cursor = String(row[0] ?? '0')
        const batch = Array.isArray(row[1]) ? row[1] : []
        for (const key of batch) {
          if (typeof key === 'string') found.push(key)
        }
      } while (cursor !== '0')
      return found
    },
  }
}
