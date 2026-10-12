/**
 * One-off copy of audited preview crate sidecars onto prod for the 23 gap
 * records. No WhoSampled. Default is dry-run.
 *
 * Preview recordings attach to a prod track only when they pass the same
 * artist / song / version / duration / complete checks the crate uses now:
 * raw-credit artistsMatch, same songTitle, searchVersionFit (unmarked track
 * takes unmarked only; marked track takes the same marker or falls back to
 * the unmarked original), duration within DURATION_SIDECAR_MS when both
 * lengths are known, and recordingIsCompleteSidecar.
 *
 * Copied sample links must be MusicBrainz recording/release URLs that match
 * a samples-material rel on that source recording, or the inverse rel on a
 * same-song / same-version sibling (recall review). Studio rels never attach
 * to a live destination. --apply holds the enrich lock, plans after acquire,
 * and requires --prod --backup=<path> --run-id. Snapshot is TYPE/PTTL/GET.
 * REST WATCH is connection-scoped, so writes use EVAL CAS against snapshot
 * dumps (equivalent). The backup stores post-apply written values; rollback
 * CAS-compares those and refuses on mismatch. Rollback refuses DEL of a
 * non-string type with a null dump. A remix with no rels does not license
 * another version's rels (duration >5s or vocal vs instrumental).
 * getRecordingSampleRels shares the 1.1s getJson limiter on one client.
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  createEnrichLockHeartbeat,
  ENRICH_LOCK_SECONDS,
  recordingIsCompleteSidecar,
} from './enrich.ts'
import { parsePositiveId } from './ids.ts'
import { isPlayableOccurrence } from './lifecycle.ts'
import {
  artistsMatch,
  DURATION_SIDECAR_MS,
  hitFromStoredRecording,
  recordingHasSampleMaterial,
  normalizeTitle,
  promoteVersionContradicts,
  recordingIsLive,
  searchVersionFit,
  songTitle,
  titleIsLive,
  type SearchVersionFit,
} from './match.ts'
import { coalesceRecordingLengthMs, preferCompleteRecording } from './preserve.ts'
import { isRecordingOrReleaseSampleLink, mergeSampleLinks } from './research.ts'
import { crateRedisKeys, selectEnrichLockToken, type CrateStore } from './store.ts'
import { assertPrefixedRedisKey, isProductionRedisNamespace } from '../redis-env.ts'
import type { SampleLink, StoredPressing, StoredRecording, TrackOccurrence } from './types.ts'
import {
  MUSICBRAINZ_RETRY_AFTER_CAP_MS,
  isMusicBrainzRateLimitError,
  type MusicBrainzClient,
} from './musicbrainz.ts'

export const GAP_RELEASE_IDS = [
  106712, 266650, 378994, 451558, 550972, 903960, 1575060, 1679157, 1930841, 3018422,
  3221873, 4217381, 4666933, 6625293, 6729400, 7482706, 10416361, 11449230, 11917223,
  13694938, 14851267, 21093352, 23467838,
] as const

export const GAP_RELEASE_ID_SET = new Set<number>(GAP_RELEASE_IDS)

export const MTUME_RELEASE_ID = 567894
export const MTUME_VOCAL_MBID = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
export const JUICY_MBID = '181c0a32-6e3f-4680-8a7d-1daf0b42e43b'

export const PROD_BAR = 360
export const PREVIEW_BAR = 389

/** Prior dry-run unknown-length copy rows to audit against MusicBrainz (≤10). */
export const UNKNOWN_LENGTH_AUDIT_MBIDS = [
  '33bcd7f3-41bc-4441-aa89-352c8a08c33a',
  '3fcae502-4191-4b3f-abb7-c6ffb8e2abf1',
  '9cb859c8-284d-4433-8a3a-6f083533e004',
  '755ea925-c364-4e59-b21f-8d0f4f73f821',
  '5bd8736d-1f1b-4666-8050-4cc03a128af5',
  '47a16400-4e94-4a15-912d-b5a6b2f174ba',
  '5461c08e-3b9d-4da0-96cd-ade17b241654',
  '83c21345-afcf-44b0-b619-f0f7c5f9b2a1',
  '13ef609a-ceb6-44c5-b1cd-6ed05b8948cf',
  'efb9067c-431c-4cd1-8703-b2894a56b3c2',
] as const

const REMIX_LIVE_EDIT_TOKENS = ['remix', 'live', 'edit', 'radio', 'club'] as const

/** MB ws/2 JSON omits relationship UUIDs; type-id is the samples-material rel id. */
export const MB_SAMPLES_MATERIAL_REL_ID = '9efd9ce9-e702-448b-8e76-641515e8fe62'

const PROMOTE_CAS_NIL = '__PROMOTE_NIL__'

/** EVAL CAS: compare GET to snapshot dumps, then SET/DEL. REST WATCH is connection-scoped. */
export const PROMOTE_WATCH_CAS_LUA = `
local n = #KEYS
for i = 1, n do
  local current = redis.call('GET', KEYS[i])
  local expected = ARGV[i]
  if expected == '${PROMOTE_CAS_NIL}' then
    if current ~= false then
      return redis.error_reply('watched key changed: ' .. KEYS[i])
    end
  elseif current ~= expected then
    return redis.error_reply('watched key changed: ' .. KEYS[i])
  end
end
local idx = n + 1
local cmdCount = tonumber(ARGV[idx])
idx = idx + 1
local unpackFn = unpack or table.unpack
for _ = 1, cmdCount do
  local argc = tonumber(ARGV[idx])
  idx = idx + 1
  local args = {}
  for j = 1, argc do
    args[j] = ARGV[idx]
    idx = idx + 1
  end
  redis.call(unpackFn(args))
end
return 'OK'
`.trim()

export const RECALL_REVIEW_ROWS = [
  {
    label: "Gangsta's Paradise / Pastime Paradise",
    releaseId: 266650,
    sourceMbid: 'd2637c43-cb52-419a-9a6d-3e1fa1b9be30',
    targetMbid: '2f7a6735-2e09-4ce2-81e4-b148e6c39a55',
    direction: 'sampled_by' as const,
  },
  {
    label: "My Lovin' / The Payback",
    releaseId: 6625293,
    sourceMbid: '824e104c-4406-46c8-b74f-bf79ef968633',
    targetMbid: 'd9154cae-507c-4b35-9021-025e320a067a',
    direction: 'sample_of' as const,
  },
  {
    label: 'Catching the Sun / フリーターストーリー',
    releaseId: 1575060,
    sourceMbid: '13b2dabd-de20-4180-97f9-c7f9528dd8b1',
    targetMbid: '3c6ebd0c-0f85-4436-a591-5bcff14ff250',
    direction: 'sampled_by' as const,
  },
  {
    label: 'Bourgié Bourgié / Guitarra G',
    releaseId: 7482706,
    sourceMbid: '723a6918-f337-4d60-8b9a-8cc89eab9a43',
    targetMbid: 'a048a0d5-54de-4dd8-b79a-747539e2ecfc',
    direction: 'sampled_by' as const,
  },
  {
    label: 'Here I Am / Any Way the Wind Blows',
    releaseId: 11917223,
    sourceMbid: 'efb9067c-431c-4cd1-8703-b2894a56b3c2',
    targetMbid: '4a72c3a9-02a8-4645-9c8e-5ab2dc7a7a33',
    direction: 'sampled_by' as const,
  },
  {
    label: 'Look What You Done for Me / Set Me Free',
    releaseId: 11917223,
    sourceMbid: '7e85160c-24b0-4645-a203-7c6f1a498a6f',
    targetMbid: '2d736e0e-8e32-49cd-a3cf-f427e1659486',
    direction: 'sampled_by' as const,
  },
  {
    label: 'Look What You Done for Me / Warm Sentiments',
    releaseId: 11917223,
    sourceMbid: '7e85160c-24b0-4645-a203-7c6f1a498a6f',
    targetMbid: '70bbe44c-d66b-4168-acbf-6bd4021f66ef',
    direction: 'sampled_by' as const,
  },
  {
    label: 'No Woman No Cry / Thin Line',
    releaseId: 13694938,
    sourceMbid: '8f540449-337b-4e4f-ab72-acbf4b1a7c85',
    targetMbid: '96501356-5008-4826-8a7d-4b393d52dd87',
    direction: 'sampled_by' as const,
  },
] as const

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
  prod: boolean
  rollbackPath?: string
  backupPath?: string
  runId?: string
  ids?: number[]
}

export type PromoteSnapshotEntry = {
  key: string
  type: string
  pttl: number
  dump: string | null
  /** Post-apply GET bytes. Rollback CAS expects this; missing → refuse. */
  written?: string | null
}

export type PromoteSnapshot = {
  createdAt: string
  runId: string
  prefix: 'lf:'
  keys: PromoteSnapshotEntry[]
}

export type PromoteRawStore = {
  getRaw(key: string): Promise<string | null>
  setRaw(key: string, value: string | null, pttlMs?: number): Promise<void>
  typeOf(key: string): Promise<string>
  pttl(key: string): Promise<number>
  dumpKey(key: string): Promise<string | null>
  scanKeys(match: string): Promise<string[]>
  multiExec(commands: string[][]): Promise<unknown[]>
  casExec(keys: string[], expected: Array<string | null>, commands: string[][]): Promise<unknown[]>
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

export type PromoteDroppedLink = {
  releaseId: number
  sourceMbid: string
  sourceTitle: string
  direction: 'sample_of' | 'sampled_by'
  title: string
  mbid: string
  reason: string
}

export type PromoteRecallReview = {
  label: string
  releaseId: number
  sourceMbid: string
  sourceTitle: string
  targetMbid: string
  targetTitle: string
  direction: 'sample_of' | 'sampled_by'
  status: 'restored' | 'confirmed_false'
  relId: string | null
  siblingMbid?: string
}

export type PromoteLengthAudit = {
  mbid: string
  title: string
  storedLengthMs: number | null
  mbLengthMs: number | null
  samplesFrom: number
  sampledIn: number
  disambiguation?: string
  live?: boolean
  releaseTitles?: string[]
}

export type PromoteVerifiedRels = {
  lengthMs: number | null
  samplesFrom: Set<string>
  sampledIn: Set<string>
  disambiguation?: string
  live?: boolean
  releaseTitles?: string[]
  samplesFromLinks?: SampleLink[]
  sampledInLinks?: SampleLink[]
  relIds?: Map<string, string>
}

export type PromoteVerifyRecording = (mbid: string) => Promise<PromoteVerifiedRels | null>

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
  droppedLinks: PromoteDroppedLink[]
  lengthAudit: PromoteLengthAudit[]
  recallReview: PromoteRecallReview[]
  lockHeld?: boolean
  rollbackCommand?: string
  runId?: string
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

export function parsePromoteIds(raw: string): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const part of raw.split(',')) {
    const token = part.trim()
    if (!token) continue
    const id = parsePositiveId(token)
    if (id === null) {
      throw new Error(`--ids= rejects ${token}`)
    }
    if (!GAP_RELEASE_ID_SET.has(id)) {
      throw new Error(`--ids= ${id} is not in the closed 23-id list`)
    }
    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  if (ids.length === 0) {
    throw new Error('--ids= requires at least one gap record id')
  }
  return ids
}

export function closedGapIds(ids: Iterable<number> | undefined): number[] {
  const wanted = uniquePositive(ids ?? GAP_RELEASE_IDS)
  for (const id of wanted) {
    if (!GAP_RELEASE_ID_SET.has(id)) {
      throw new Error(`id ${id} is not in the closed 23-id list`)
    }
  }
  return wanted
}

export function parsePromoteArgs(argv: string[]): PromoteArgs {
  const args: PromoteArgs = { apply: false, prod: false }
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]
    if (!raw) continue
    if (raw === '--apply') args.apply = true
    else if (raw === '--prod') args.prod = true
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
    } else if (raw === '--run-id') {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        throw new Error('--run-id requires a value')
      }
      args.runId = next
      i += 1
    } else if (raw.startsWith('--run-id=')) {
      args.runId = raw.slice('--run-id='.length)
    } else if (raw.startsWith('--ids=')) {
      args.ids = parsePromoteIds(raw.slice('--ids='.length))
    }
  }
  if (args.apply && args.rollbackPath) {
    throw new Error('pass --apply or --rollback, not both')
  }
  if (args.apply) {
    if (!args.backupPath) throw new Error('--apply requires --backup=<path>')
    if (!args.prod) throw new Error('refusing prod Redis keys; pass --prod')
    if (!args.runId?.trim()) throw new Error('--apply requires --run-id')
  }
  if (args.rollbackPath) {
    if (!args.prod) throw new Error('refusing prod Redis keys; pass --prod')
    if (!args.runId?.trim()) throw new Error('--rollback requires --run-id')
  }
  return args
}

export function assertPromoteProdAllowed(
  options: { prod?: boolean; env?: EnvMap } = {}
): void {
  if (options.prod) return
  const env = options.env ?? process.env
  if (isProductionRedisNamespace(env) || crateRedisKeys(env).prefix === 'lf:') {
    throw new Error('refusing prod Redis keys; pass --prod')
  }
}

export function assertProdPromoteKey(key: string, env: EnvMap = PROD_NAMESPACE_ENV): string {
  if (key.startsWith('lf:preview:')) {
    throw new Error(`prod Redis must not write preview key: ${key}`)
  }
  if (!key.startsWith('lf:')) {
    throw new Error(`prod promote key must start with lf: excluding lf:preview: (${key})`)
  }
  return assertPrefixedRedisKey(key, env)
}

export function promoteRollbackCommand(backupPath: string, runId?: string): string {
  const run = runId?.trim() ? ` --run-id=${runId.trim()}` : ''
  return `npm run crate:promote-preview -- --rollback ${backupPath} --prod${run}`
}

export class PromoteApplyError extends Error {
  readonly backupPath: string
  readonly rollbackCommand: string

  constructor(backupPath: string, cause: unknown, runId?: string) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`promote apply failed after snapshot (${detail}). backup=${backupPath}`)
    this.name = 'PromoteApplyError'
    this.backupPath = backupPath
    this.rollbackCommand = promoteRollbackCommand(backupPath, runId)
  }
}

export function isPromoteMbSampleLink(link: SampleLink): boolean {
  if (link.source !== 'musicbrainz') return false
  if (!link.mbid) return false
  if (!isRecordingOrReleaseSampleLink(link)) return false
  return /musicbrainz\.org\/(?:recording|release)\//i.test(link.sourceUrl ?? '')
}

export function destinationIsLive(pressing: StoredPressing, tracks: TrackOccurrence[]): boolean {
  if (titleIsLive(pressing.facts.title)) return true
  if (/\balive\b/.test(normalizeTitle(pressing.facts.title))) return true
  return tracks.some((track) => titleIsLive(track.title))
}

export function recordingAppearsOnPressing(
  releaseTitles: string[] | undefined,
  destTitle: string
): boolean {
  if (!releaseTitles || releaseTitles.length === 0) return false
  const dest = normalizeTitle(destTitle)
  if (!dest) return false
  return releaseTitles.some((title) => {
    const got = normalizeTitle(title)
    if (got === dest) return true
    return titleIsLive(destTitle) && titleIsLive(title)
  })
}

export function promoteRecordingIsLive(
  recording: { title: string },
  verified?: PromoteVerifiedRels | null
): boolean {
  return recordingIsLive({
    title: recording.title,
    disambiguation: verified?.disambiguation,
    releaseTitles: verified?.releaseTitles,
    live: verified?.live,
  })
}

function dedupeAddedLinks(links: PromoteAddedLink[]): PromoteAddedLink[] {
  const seen = new Set<string>()
  const out: PromoteAddedLink[] = []
  for (const link of links) {
    const key = `${link.direction}\u001f${link.mbid || link.sourceUrl}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(link)
  }
  return out
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
  if (titleIsLive(discogs.title) && !titleIsLive(hit.title)) return false
  if (promoteVersionContradicts(discogs.title, hit.title)) return false
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
  for (const link of to.samplesFrom.filter(isPromoteMbSampleLink)) {
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
  for (const link of to.sampledIn.filter(isPromoteMbSampleLink)) {
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
  return dedupeAddedLinks(added)
}

export function filterPreviewSampleLinks(
  preview: StoredRecording,
  verified: PromoteVerifiedRels | null | undefined,
  requireVerified = false
): { recording: StoredRecording; dropped: Array<Omit<PromoteDroppedLink, 'releaseId'>> } {
  const dropped: Array<Omit<PromoteDroppedLink, 'releaseId'>> = []
  const empty = new Set<string>()
  const fromAllowed = requireVerified ? (verified?.samplesFrom ?? empty) : verified?.samplesFrom
  const inAllowed = requireVerified ? (verified?.sampledIn ?? empty) : verified?.sampledIn
  const keepFrom = (link: SampleLink, direction: 'sample_of' | 'sampled_by', allowed?: Set<string>) => {
    if (!isPromoteMbSampleLink(link)) {
      dropped.push({
        sourceMbid: preview.mbid,
        sourceTitle: preview.title,
        direction,
        title: link.title,
        mbid: link.mbid,
        reason: 'not musicbrainz samples rel',
      })
      return false
    }
    if (allowed && !allowed.has(link.mbid)) {
      dropped.push({
        sourceMbid: preview.mbid,
        sourceTitle: preview.title,
        direction,
        title: link.title,
        mbid: link.mbid,
        reason: 'not on source recording',
      })
      return false
    }
    return true
  }
  const samplesFrom = mergeSampleLinks(
    preview.samplesFrom.filter((link) => keepFrom(link, 'sample_of', fromAllowed))
  )
  const sampledIn = mergeSampleLinks(
    preview.sampledIn.filter((link) => keepFrom(link, 'sampled_by', inAllowed))
  )
  return {
    recording: {
      ...preview,
      samplesFrom,
      sampledIn,
      lengthMs: coalesceRecordingLengthMs(preview.lengthMs, verified?.lengthMs ?? null),
    },
    dropped,
  }
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

async function sleepPromoteMb(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function createPromoteMbLookup(
  mb: Pick<MusicBrainzClient, 'getRecordingSampleRels'>,
  cache = new Map<string, PromoteVerifiedRels | null>()
): PromoteVerifyRecording {
  return async (mbid: string) => {
    if (cache.has(mbid)) return cache.get(mbid) ?? null
    let facts: Awaited<ReturnType<MusicBrainzClient['getRecordingSampleRels']>> | undefined
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        facts = await mb.getRecordingSampleRels(mbid)
        break
      } catch (error) {
        if (!isMusicBrainzRateLimitError(error) || attempt === 3) throw error
        const wait = Math.min(
          Math.max(error.retryAfterMs || 60_000, 15_000),
          MUSICBRAINZ_RETRY_AFTER_CAP_MS
        )
        await sleepPromoteMb(wait)
      }
    }
    if (!facts) {
      cache.set(mbid, null)
      return null
    }
    const relIds = new Map<string, string>(Object.entries(facts.relIds ?? {}))
    const verified: PromoteVerifiedRels = {
      lengthMs: facts.lengthMs,
      samplesFrom: new Set(facts.samplesFrom.map((link) => link.mbid).filter(Boolean)),
      sampledIn: new Set(facts.sampledIn.map((link) => link.mbid).filter(Boolean)),
      samplesFromLinks: facts.samplesFrom,
      sampledInLinks: facts.sampledIn,
      relIds,
      disambiguation: facts.disambiguation,
      releaseTitles: facts.releaseTitles,
      live: recordingIsLive({
        title: facts.title,
        disambiguation: facts.disambiguation,
        releaseTitles: facts.releaseTitles,
      }),
    }
    cache.set(mbid, verified)
    return verified
  }
}

function inverseSampleLinks(
  verified: PromoteVerifiedRels,
  direction: 'sample_of' | 'sampled_by'
): SampleLink[] {
  if (direction === 'sampled_by') return verified.samplesFromLinks ?? []
  return verified.sampledInLinks ?? []
}

function inverseSampleIds(
  verified: PromoteVerifiedRels,
  direction: 'sample_of' | 'sampled_by'
): Set<string> {
  if (direction === 'sampled_by') return verified.samplesFrom
  return verified.sampledIn
}

async function applyRecallReview(options: {
  preview: StoredRecording
  releaseId: number
  verified: PromoteVerifiedRels
  verifyRecording: PromoteVerifyRecording
  pulse?: () => Promise<boolean | void>
}): Promise<{ verified: PromoteVerifiedRels; rows: PromoteRecallReview[] }> {
  const rows: PromoteRecallReview[] = []
  const next: PromoteVerifiedRels = {
    ...options.verified,
    samplesFrom: new Set(options.verified.samplesFrom),
    sampledIn: new Set(options.verified.sampledIn),
    relIds: new Map(options.verified.relIds ?? []),
  }
  const wanted = RECALL_REVIEW_ROWS.filter(
    (row) => row.releaseId === options.releaseId && row.sourceMbid === options.preview.mbid
  )
  for (const row of wanted) {
    if (options.pulse) await options.pulse()
    const target = await options.verifyRecording(row.targetMbid)
    const previewLink = [...options.preview.samplesFrom, ...options.preview.sampledIn].find(
      (link) => link.mbid === row.targetMbid
    )
    const targetTitle = previewLink?.title ?? row.label.split(' / ')[0] ?? row.label
    if (!target) {
      rows.push({
        label: row.label,
        releaseId: row.releaseId,
        sourceMbid: row.sourceMbid,
        sourceTitle: options.preview.title,
        targetMbid: row.targetMbid,
        targetTitle,
        direction: row.direction,
        status: 'confirmed_false',
        relId: null,
      })
      continue
    }
    const inverseIds = inverseSampleIds(target, row.direction)
    const inverseLinks = inverseSampleLinks(target, row.direction)
    const direct = inverseIds.has(options.preview.mbid)
    const siblingLink = inverseLinks.find(
      (link) =>
        link.mbid &&
        link.mbid !== options.preview.mbid &&
        recallSameSongOrVersion(options.preview, link)
    )
    const siblingMbid = direct ? undefined : siblingLink?.mbid
    const relId =
      target.relIds?.get(direct ? options.preview.mbid : siblingMbid ?? '') ??
      (direct || siblingLink ? MB_SAMPLES_MATERIAL_REL_ID : null)
    if (direct || siblingLink) {
      if (row.direction === 'sampled_by') next.sampledIn.add(row.targetMbid)
      else next.samplesFrom.add(row.targetMbid)
      if (relId) next.relIds?.set(row.targetMbid, relId)
      rows.push({
        label: row.label,
        releaseId: row.releaseId,
        sourceMbid: row.sourceMbid,
        sourceTitle: options.preview.title,
        targetMbid: row.targetMbid,
        targetTitle,
        direction: row.direction,
        status: 'restored',
        relId,
        siblingMbid,
      })
      continue
    }
    const wrongVersion = inverseLinks.find((link) => link.mbid && songTitle(link.title) === songTitle(options.preview.title))
    rows.push({
      label: row.label,
      releaseId: row.releaseId,
      sourceMbid: row.sourceMbid,
      sourceTitle: options.preview.title,
      targetMbid: row.targetMbid,
      targetTitle,
      direction: row.direction,
      status: 'confirmed_false',
      relId: wrongVersion
        ? target.relIds?.get(wrongVersion.mbid) ?? MB_SAMPLES_MATERIAL_REL_ID
        : inverseLinks[0]
          ? target.relIds?.get(inverseLinks[0].mbid) ?? MB_SAMPLES_MATERIAL_REL_ID
          : null,
      siblingMbid: wrongVersion?.mbid ?? inverseLinks[0]?.mbid,
    })
  }
  return { verified: next, rows }
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

function expireAtFromPttl(pttlMs: number | undefined): number | null {
  if (pttlMs == null || pttlMs < 0) return null
  if (pttlMs === 0) return Date.now()
  return Date.now() + pttlMs
}

function remainingPttl(expireAt: number | null | undefined, exists: boolean): number {
  if (!exists) return -2
  if (expireAt == null) return -1
  return Math.max(0, expireAt - Date.now())
}

export function restoreCommandsForEntry(entry: PromoteSnapshotEntry): string[][] {
  const key = assertProdPromoteKey(entry.key)
  if (entry.dump == null && entry.type !== 'string' && entry.type !== 'none') {
    throw new Error(`refusing rollback DEL of ${entry.type} key ${key} with null dump`)
  }
  if (entry.dump == null || entry.type === 'none' || entry.pttl === -2) {
    return [['DEL', key]]
  }
  if (entry.pttl > 0) {
    return [['SET', key, entry.dump, 'PX', String(entry.pttl)]]
  }
  return [['SET', key, entry.dump]]
}

export function applyCommandsForWrites(writes: PlannedWrite[]): string[][] {
  const recordings = writes.filter((write) => write.kind === 'recording' && write.recording)
  const pressings = writes.filter((write) => write.kind === 'pressing' && write.pressing)
  const commands: string[][] = []
  for (const write of [...recordings, ...pressings]) {
    const key = assertProdPromoteKey(write.key)
    const doc = write.kind === 'recording' ? write.recording : write.pressing
    commands.push(['SET', key, JSON.stringify(doc)])
  }
  return commands
}

export async function runWatchedPromoteCommands(
  raw: PromoteRawStore,
  keys: string[],
  commands: string[][],
  expectedDumps: Array<string | null>
): Promise<void> {
  if (commands.length === 0) return
  const guarded = keys.map((key) => assertProdPromoteKey(key))
  await raw.casExec(guarded, expectedDumps, commands)
}

export function stampSnapshotWritten(
  snapshot: PromoteSnapshot,
  commands: string[][]
): PromoteSnapshot {
  const written = new Map<string, string | null>()
  for (const command of commands) {
    const op = command[0]
    const key = command[1]
    if (!op || !key) continue
    if (op === 'DEL') written.set(key, null)
    if (op === 'SET' && command[2] != null) written.set(key, command[2])
  }
  return {
    ...snapshot,
    keys: snapshot.keys.map((entry) => {
      if (!written.has(entry.key)) {
        throw new Error(`apply snapshot missing post-apply written value for ${entry.key}`)
      }
      return { ...entry, written: written.get(entry.key) ?? null }
    }),
  }
}

export function snapshotWrittenDumps(snapshot: PromoteSnapshot): Array<string | null> {
  return snapshot.keys.map((entry) => {
    if (!Object.prototype.hasOwnProperty.call(entry, 'written')) {
      throw new Error(`refusing rollback: ${entry.key} missing post-apply written value`)
    }
    return entry.written ?? null
  })
}

export function recallSameSongOrVersion(
  source: { title: string },
  sibling: { title: string }
): boolean {
  const left = songTitle(source.title)
  const right = songTitle(sibling.title)
  if (!left || !right || left !== right) return false
  if (promoteVersionContradicts(source.title, sibling.title)) return false
  return searchVersionFit(source.title, sibling.title) !== 'wrong'
}

function samePromotePerformance(
  preview: { title: string; lengthMs?: number | null },
  host: { title: string; lengthMs?: number | null }
): boolean {
  if (!recallSameSongOrVersion(preview, host)) return false
  const previewLength = preview.lengthMs ?? null
  const hostLength = host.lengthMs ?? null
  if (previewLength != null && hostLength != null) {
    if (Math.abs(previewLength - hostLength) > DURATION_SIDECAR_MS) return false
  }
  return true
}

export function memoryPromoteRawStore(
  store: {
    pressings: Record<number, StoredPressing>
    recordings: Record<string, StoredRecording>
  },
  env: EnvMap
): PromoteRawStore {
  const keys = crateRedisKeys(env)
  const expireAt = new Map<string, number | null>()
  const pressingRe = new RegExp(`^${keys.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}crate:pressing:(\\d+):v1$`)
  const recordingRe = new RegExp(
    `^${keys.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}crate:recording:(.+):v1$`
  )

  async function readExisting(key: string): Promise<string | null> {
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
  }

  async function writeExisting(key: string, value: string | null, pttlMs?: number): Promise<void> {
    assertProdPromoteKey(key, env.VERCEL_ENV === 'production' ? env : PROD_NAMESPACE_ENV)
    const pressing = pressingRe.exec(key)
    if (pressing) {
      const id = Number.parseInt(pressing[1] ?? '', 10)
      if (value == null) {
        delete store.pressings[id]
        expireAt.delete(key)
        return
      }
      store.pressings[id] = JSON.parse(value) as StoredPressing
      expireAt.set(key, expireAtFromPttl(pttlMs))
      return
    }
    const recording = recordingRe.exec(key)
    if (recording) {
      const mbid = recording[1] ?? ''
      if (value == null) {
        delete store.recordings[mbid]
        expireAt.delete(key)
        return
      }
      store.recordings[mbid] = JSON.parse(value) as StoredRecording
      expireAt.set(key, expireAtFromPttl(pttlMs))
      return
    }
    throw new Error(`unsupported promote key: ${key}`)
  }

  const raw: PromoteRawStore = {
    async getRaw(key: string) {
      return readExisting(key)
    },
    async setRaw(key: string, value: string | null, pttlMs?: number) {
      await writeExisting(key, value, pttlMs)
    },
    async typeOf(key: string) {
      const value = await readExisting(key)
      return value == null ? 'none' : 'string'
    },
    async pttl(key: string) {
      const value = await readExisting(key)
      return remainingPttl(expireAt.get(key), value != null)
    },
    async dumpKey(key: string) {
      return readExisting(key)
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
    async multiExec(commands: string[][]) {
      const results: unknown[] = []
      for (const command of commands) {
        const op = command[0]
        const key = command[1]
        if (!op || !key) throw new Error('empty promote command')
        if (op === 'DEL') {
          await raw.setRaw(key, null)
          results.push(1)
          continue
        }
        if (op === 'SET') {
          const value = command[2]
          if (value == null) throw new Error(`SET missing value for ${key}`)
          let pttlMs: number | undefined
          if (command[3] === 'PX') {
            pttlMs = Number(command[4])
          }
          await raw.setRaw(key, value, pttlMs)
          results.push('OK')
          continue
        }
        if (op === 'PEXPIRE') {
          const ms = Number(command[2])
          const value = await raw.getRaw(key)
          if (value == null) {
            results.push(0)
            continue
          }
          expireAt.set(key, expireAtFromPttl(ms))
          results.push(1)
          continue
        }
        throw new Error(`unsupported promote command: ${op}`)
      }
      return results
    },
    async casExec(keys: string[], expected: Array<string | null>, commands: string[][]) {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        if (!key) continue
        const current = await raw.getRaw(key)
        if (current !== (expected[i] ?? null)) {
          throw new Error(`watched key changed: ${key}`)
        }
      }
      return raw.multiExec(commands)
    },
  }
  return raw
}

export async function snapshotPromoteKeys(
  raw: PromoteRawStore,
  keys: string[],
  prefix: 'lf:',
  runId: string
): Promise<PromoteSnapshot> {
  if (prefix !== 'lf:') {
    throw new Error(`snapshot prefix must be lf: (got ${prefix})`)
  }
  if (!runId.trim()) throw new Error('snapshot requires a run id')
  const entries: PromoteSnapshotEntry[] = []
  for (const key of keys) {
    const guarded = assertProdPromoteKey(key)
    const type = await raw.typeOf(guarded)
    const pttl = await raw.pttl(guarded)
    const dump = type === 'string' ? await raw.dumpKey(guarded) : null
    entries.push({ key: guarded, type, pttl, dump })
  }
  return { createdAt: new Date().toISOString(), runId, prefix: 'lf:', keys: entries }
}

export async function restorePromoteSnapshot(
  raw: PromoteRawStore,
  snapshot: PromoteSnapshot,
  runId: string
): Promise<string[]> {
  if (snapshot.prefix !== 'lf:') {
    throw new Error(`snapshot prefix ${snapshot.prefix} does not match lf:`)
  }
  if (!runId.trim() || snapshot.runId !== runId) {
    throw new Error(`snapshot run-id ${snapshot.runId} does not match --run-id ${runId}`)
  }
  const commands = snapshot.keys.flatMap((entry) => restoreCommandsForEntry(entry))
  await runWatchedPromoteCommands(
    raw,
    snapshot.keys.map((entry) => entry.key),
    commands,
    snapshotWrittenDumps(snapshot)
  )
  return snapshot.keys.map((entry) => assertProdPromoteKey(entry.key))
}

export function writePromoteSnapshotFile(path: string, snapshot: PromoteSnapshot): void {
  if (snapshot.prefix !== 'lf:') {
    throw new Error(`refusing to write snapshot with prefix ${snapshot.prefix}`)
  }
  if (!snapshot.runId.trim()) throw new Error('snapshot requires a run id')
  for (const entry of snapshot.keys) assertProdPromoteKey(entry.key)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(snapshot), { encoding: 'utf8', mode: 0o600 })
}

export function readPromoteSnapshotFile(path: string): PromoteSnapshot {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as PromoteSnapshot
  if (!parsed || parsed.prefix !== 'lf:' || !parsed.runId || !Array.isArray(parsed.keys)) {
    throw new Error(`invalid promote snapshot: ${path}`)
  }
  for (const entry of parsed.keys) assertProdPromoteKey(entry.key)
  return parsed
}

async function planCopies(options: {
  prod: CrateStore
  preview: CrateStore
  prodKeys: ReturnType<typeof crateRedisKeys>
  ids: number[]
  verifyRecording?: PromoteVerifyRecording
  pulse?: () => Promise<boolean | void>
}): Promise<{
  records: PromoteRecordRow[]
  writes: PlannedWrite[]
  remixLiveEdit: PromoteAddedLink[]
  borderline: PromoteReport['borderline']
  droppedLinks: PromoteDroppedLink[]
  lengthAudit: PromoteLengthAudit[]
  recallReview: PromoteRecallReview[]
}> {
  const { prod, preview, prodKeys, ids } = options
  const records: PromoteRecordRow[] = []
  const writes: PlannedWrite[] = []
  const remixLiveEdit: PromoteAddedLink[] = []
  const borderline: PromoteReport['borderline'] = []
  const droppedLinks: PromoteDroppedLink[] = []
  const lengthAudit: PromoteLengthAudit[] = []
  const recallReview: PromoteRecallReview[] = []
  const audited = new Set<string>()
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
      let matched = matchingTracks(prodPressing, previewDoc)
      if (matched.length === 0) {
        skips.push({ releaseId, mbid, title: previewDoc.title, reason: 'no matching prod track' })
        continue
      }
      const destLive = destinationIsLive(prodPressing, matched)
      const prodDocEarly = await loadRecording(prod, prodPressing.recordings[mbid], mbid)
      const tentative = filterPreviewSampleLinks(previewDoc, undefined, false).recording
      const tentativeAdded = addedSampleLinks(prodPressing.recordings[mbid] ?? prodDocEarly, tentative)
      const auditThis =
        UNKNOWN_LENGTH_AUDIT_MBIDS.includes(mbid as (typeof UNKNOWN_LENGTH_AUDIT_MBIDS)[number]) &&
        previewDoc.lengthMs == null
      const needsVerify =
        Boolean(options.verifyRecording) &&
        (auditThis ||
          tentativeAdded.length > 0 ||
          (!alreadyOnMap && recordingHasSampleMaterial(tentative)))
      if (options.pulse && needsVerify) await options.pulse()
      let verified: PromoteVerifiedRels | null | undefined
      if (needsVerify && options.verifyRecording) {
        verified = await options.verifyRecording(mbid)
      }
      const recLive = promoteRecordingIsLive(previewDoc, verified)
      if (needsVerify && !audited.has(mbid)) {
        audited.add(mbid)
        lengthAudit.push({
          mbid,
          title: previewDoc.title,
          storedLengthMs: previewDoc.lengthMs ?? null,
          mbLengthMs: verified?.lengthMs ?? null,
          samplesFrom: verified?.samplesFrom.size ?? 0,
          sampledIn: verified?.sampledIn.size ?? 0,
          disambiguation: verified?.disambiguation,
          live: recLive,
          releaseTitles: verified?.releaseTitles,
        })
      }
      if (destLive && !recLive) {
        skips.push({ releaseId, mbid, title: previewDoc.title, reason: 'studio recording on live dest' })
        continue
      }
      if (!destLive && recLive) {
        skips.push({ releaseId, mbid, title: previewDoc.title, reason: 'live recording on studio dest' })
        continue
      }
      let recallRows: PromoteRecallReview[] = []
      if (verified && needsVerify && options.verifyRecording) {
        const recall = await applyRecallReview({
          preview: previewDoc,
          releaseId,
          verified,
          verifyRecording: options.verifyRecording,
          pulse: options.pulse,
        })
        verified = recall.verified
        recallRows = recall.rows
        recallReview.push(...recall.rows)
      }
      const previewLength = coalesceRecordingLengthMs(previewDoc.lengthMs, verified?.lengthMs ?? null)
      const previewForMatch = { ...previewDoc, lengthMs: previewLength }
      matched = matchingTracks(prodPressing, previewForMatch)
      const mappedSameSong = Object.values(nextRecordings).filter(
        (doc) =>
          doc.mbid !== previewDoc.mbid &&
          songTitle(doc.title) === songTitle(previewDoc.title) &&
          artistsMatch(doc.artist, previewDoc.artist)
      )
      const mappedSameSongWithSamples = mappedSameSong.filter((doc) =>
        recordingHasSampleMaterial(doc)
      )
      const mappedIncompatible = mappedSameSong.filter(
        (doc) => !samePromotePerformance(previewForMatch, doc)
      )
      const destReleaseMismatch =
        Boolean(verified) &&
        (verified?.releaseTitles?.length ?? 0) > 0 &&
        artistsMatch(prodPressing.facts.artist, previewDoc.artist) &&
        !recordingAppearsOnPressing(verified?.releaseTitles, prodPressing.facts.title) &&
        (mappedSameSongWithSamples.length > 0 || mappedIncompatible.length > 0)
      const restoredIds = new Set(
        recallRows.filter((row) => row.status === 'restored').map((row) => row.targetMbid)
      )
      let attachHost: StoredRecording | null = null
      if (destReleaseMismatch) {
        const host = mappedSameSongWithSamples.find((doc) =>
          samePromotePerformance(previewForMatch, doc)
        )
        if (host && restoredIds.size > 0) {
          attachHost = host
        } else {
          skips.push({
            releaseId,
            mbid,
            title: previewDoc.title,
            reason: 'recording not on dest release',
          })
          continue
        }
      }
      if (matched.length === 0 && !attachHost) {
        skips.push({ releaseId, mbid, title: previewDoc.title, reason: 'no matching prod track' })
        continue
      }
      const filtered = filterPreviewSampleLinks(
        previewDoc,
        verified,
        Boolean(options.verifyRecording) && needsVerify
      )
      for (const drop of filtered.dropped) {
        droppedLinks.push({ ...drop, releaseId })
      }
      const previewFiltered = attachHost
        ? {
            ...attachHost,
            samplesFrom: mergeSampleLinks(
              attachHost.samplesFrom,
              filtered.recording.samplesFrom.filter((link) => restoredIds.has(link.mbid))
            ),
            sampledIn: mergeSampleLinks(
              attachHost.sampledIn,
              filtered.recording.sampledIn.filter((link) => restoredIds.has(link.mbid))
            ),
          }
        : filtered.recording
      if (attachHost) {
        skips.push({
          releaseId,
          mbid,
          title: previewDoc.title,
          reason: 'recording not on dest release',
        })
      }
      const copyMbid = attachHost?.mbid ?? mbid
      const prodDoc = attachHost
        ? await loadRecording(prod, nextRecordings[copyMbid] ?? attachHost, copyMbid)
        : prodDocEarly
      const copyAlreadyOnMap = attachHost ? true : alreadyOnMap
      if (
        prodDoc &&
        recordingIsCompleteSidecar(prodDoc) &&
        countRecordingLinks(prodDoc).links > countRecordingLinks(previewFiltered).links &&
        addedSampleLinks(prodDoc, previewFiltered).length === 0 &&
        copyAlreadyOnMap
      ) {
        skips.push({
          releaseId,
          mbid,
          title: previewDoc.title,
          reason: 'complete prod doc has more sample rels',
        })
        continue
      }
      const merged = preferCompleteRecording(prodDoc, mergePromoteRecording(prodDoc, previewFiltered))
      const addedLinks = addedSampleLinks(
        prodPressing.recordings[copyMbid] ?? prodDoc,
        merged
      )
      const mapEntryChanged =
        !copyAlreadyOnMap || JSON.stringify(nextRecordings[copyMbid] ?? null) !== JSON.stringify(merged)
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
      if (!recordingHasSampleMaterial(merged) && !copyAlreadyOnMap) {
        skips.push({ releaseId, mbid, title: previewDoc.title, reason: 'no sample rels' })
        continue
      }

      nextRecordings[copyMbid] = merged
      if (mapEntryChanged) mapChanged = true
      const fit =
        matched[0] != null
          ? searchVersionFit(matched[0].title, previewDoc.title)
          : searchVersionFit(previewDoc.title, previewDoc.title)
      const notes = copyBorderline(previewFiltered, fit, matched)
      copies.push({
        releaseId,
        mbid: copyMbid,
        recordingTitle: attachHost?.title ?? previewDoc.title,
        recordingArtist: attachHost?.artist ?? previewDoc.artist,
        alreadyOnMap: copyAlreadyOnMap,
        versionFit: fit,
        matchedTracks: matched.map((track) => ({ position: track.position, title: track.title })),
        addedLinks,
        borderline: notes,
      })
      if (notes.length > 0) {
        borderline.push({ releaseId, mbid: copyMbid, title: attachHost?.title ?? previewDoc.title, notes })
      }
      for (const link of addedLinks) {
        if (link.versionFlags.length > 0) remixLiveEdit.push({ ...link, releaseId })
      }
      if (!attachHost && versionFlags(previewDoc.title).length > 0) {
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
      if (redisNeedsWrite && !recordingWriteMbids.has(copyMbid)) {
        recordingWriteMbids.add(copyMbid)
        writes.push({
          key: assertProdPromoteKey(prodKeys.recording(copyMbid)),
          kind: 'recording',
          mbid: copyMbid,
          recording: merged,
        })
      }
    }

    const projected = countPressingMapLinks({ ...prodPressing, recordings: nextRecordings })
    if (mapChanged) {
      writes.push({
        key: assertProdPromoteKey(prodKeys.pressing(releaseId)),
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

  const plannedMbids = new Set(records.flatMap((row) => row.copies.map((copy) => copy.mbid)))
  const closedWrites = writes.filter(
    (write) => write.kind !== 'recording' || (write.mbid != null && plannedMbids.has(write.mbid))
  )

  return {
    records,
    writes: closedWrites,
    remixLiveEdit: dedupeAddedLinks(remixLiveEdit),
    borderline,
    droppedLinks,
    lengthAudit,
    recallReview,
  }
}

function emptyPlanExtras(): Pick<PromoteReport, 'droppedLinks' | 'lengthAudit' | 'recallReview'> {
  return { droppedLinks: [], lengthAudit: [], recallReview: [] }
}

async function reportFromPlan(input: {
  mode: PromoteMode
  wrote: boolean
  prodPrefix: string
  previewPrefix: string
  keys: string[]
  backupPath?: string
  restored?: string[]
  currentProd: SampleTotals
  currentPreview: SampleTotals
  projectedProd: SampleTotals
  planned: Awaited<ReturnType<typeof planCopies>>
  ids: number[]
  prodKeys: ReturnType<typeof crateRedisKeys>
  prod: CrateStore
  lockHeld?: boolean
  runId?: string
}): Promise<PromoteReport> {
  const mtume = await juicyLinked(input.prod)
  return {
    mode: input.mode,
    prodPrefix: input.prodPrefix,
    previewPrefix: input.previewPrefix,
    wrote: input.wrote,
    keys: input.keys,
    backupPath: input.backupPath,
    restored: input.restored,
    currentProd: input.currentProd,
    currentPreview: input.currentPreview,
    projectedProd: input.projectedProd,
    vs360: input.projectedProd.links - PROD_BAR,
    vs389: input.projectedProd.links - PREVIEW_BAR,
    records: input.planned.records,
    remixLiveEdit: input.planned.remixLiveEdit,
    borderline: input.planned.borderline,
    droppedLinks: input.planned.droppedLinks,
    lengthAudit: input.planned.lengthAudit,
    recallReview: input.planned.recallReview,
    lockHeld: input.lockHeld,
    runId: input.runId,
    rollbackCommand: input.backupPath
      ? promoteRollbackCommand(input.backupPath, input.runId)
      : undefined,
    mtume: {
      releaseId: MTUME_RELEASE_ID,
      inGapIds: input.ids.includes(MTUME_RELEASE_ID),
      plannedPressingWrite: input.keys.includes(input.prodKeys.pressing(MTUME_RELEASE_ID)),
      vocalMbid: MTUME_VOCAL_MBID,
      ...mtume,
    },
  }
}

export async function runPromotePreview(options: {
  prod: CrateStore
  preview: CrateStore
  prodEnv: EnvMap
  previewEnv: EnvMap
  ids?: number[]
  apply?: boolean
  allowProd?: boolean
  rollbackPath?: string
  backupPath?: string
  runId?: string
  raw?: PromoteRawStore
  verifyRecording?: PromoteVerifyRecording
}): Promise<PromoteReport> {
  const { prodPrefix, previewPrefix } = assertPromotePrefixes(options.prodEnv, options.previewEnv)
  const prodKeys = crateRedisKeys(options.prodEnv)
  const ids = closedGapIds(options.ids)
  const runId = options.runId?.trim()

  if (options.rollbackPath) {
    assertPromoteProdAllowed({ prod: options.allowProd, env: options.prodEnv })
    if (!runId) throw new Error('--rollback requires --run-id')
    if (!options.raw) throw new Error('rollback needs a raw store')
    const snapshot = readPromoteSnapshotFile(options.rollbackPath)
    if (snapshot.prefix !== 'lf:' || prodPrefix !== 'lf:') {
      throw new Error(`snapshot prefix ${snapshot.prefix} does not match lf:`)
    }
    const token = selectEnrichLockToken()
    const held = await options.prod.acquireEnrichLock(ENRICH_LOCK_SECONDS, token)
    if (!held) throw new Error('enrich lock held (lf:crate:enrich:lock:v1)')
    try {
      const restored = await restorePromoteSnapshot(options.raw, snapshot, runId)
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
        ...emptyPlanExtras(),
        lockHeld: true,
        runId,
        rollbackCommand: promoteRollbackCommand(options.rollbackPath, runId),
        mtume: {
          releaseId: MTUME_RELEASE_ID,
          inGapIds: ids.includes(MTUME_RELEASE_ID),
          plannedPressingWrite: restored.includes(prodKeys.pressing(MTUME_RELEASE_ID)),
          vocalMbid: MTUME_VOCAL_MBID,
          ...mtume,
        },
      }
    } finally {
      await options.prod.releaseEnrichLock(token)
    }
  }

  const planOpts = {
    prod: options.prod,
    preview: options.preview,
    prodKeys,
    ids,
    verifyRecording: options.verifyRecording,
  }

  if (!options.apply) {
    const planned = await planCopies(planOpts)
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
    return reportFromPlan({
      mode: 'dry-run',
      wrote: false,
      prodPrefix,
      previewPrefix,
      keys,
      currentProd,
      currentPreview,
      projectedProd,
      planned,
      ids,
      prodKeys,
      prod: options.prod,
    })
  }

  assertPromoteProdAllowed({ prod: options.allowProd, env: options.prodEnv })
  if (!runId) throw new Error('--apply requires --run-id')
  if (!options.backupPath) throw new Error('--apply requires --backup=<path>')
  if (!options.raw) throw new Error('--apply needs a raw store for the backup snapshot')
  if (prodPrefix !== 'lf:') throw new Error(`prod prefix must be lf: (got ${prodPrefix})`)
  const backupPath = options.backupPath
  const token = selectEnrichLockToken()
  const held = await options.prod.acquireEnrichLock(ENRICH_LOCK_SECONDS, token)
  if (!held) throw new Error('enrich lock held (lf:crate:enrich:lock:v1)')
  const heartbeat = createEnrichLockHeartbeat(
    options.prod,
    token,
    ENRICH_LOCK_SECONDS,
    () => Date.now()
  )
  try {
    await heartbeat()
    const planned = await planCopies({ ...planOpts, pulse: heartbeat })
    const keys = [...new Set(planned.writes.map((write) => write.key))].sort()
    for (const key of keys) assertProdPromoteKey(key)
    const currentProd = await totalsFor(options.prod, ids, options.raw, prodPrefix)
    const currentPreview = await totalsFor(options.preview, ids, options.raw, previewPrefix)
    const snapshot = await snapshotPromoteKeys(options.raw, keys, 'lf:', runId)
    writePromoteSnapshotFile(backupPath, snapshot)
    try {
      await heartbeat()
      const applyCommands = applyCommandsForWrites(planned.writes)
      await runWatchedPromoteCommands(
        options.raw,
        snapshot.keys.map((entry) => entry.key),
        applyCommands,
        snapshot.keys.map((entry) => entry.dump)
      )
      writePromoteSnapshotFile(backupPath, stampSnapshotWritten(snapshot, applyCommands))
    } catch (error) {
      const applyError = new PromoteApplyError(backupPath, error, runId)
      console.error(applyError.message)
      console.error(applyError.rollbackCommand)
      throw applyError
    }
    const afterProd = await totalsFor(options.prod, ids, options.raw, prodPrefix)
    return reportFromPlan({
      mode: 'apply',
      wrote: true,
      prodPrefix,
      previewPrefix,
      keys,
      backupPath,
      currentProd,
      currentPreview,
      projectedProd: afterProd,
      planned,
      ids,
      prodKeys,
      prod: options.prod,
      lockHeld: true,
      runId,
    })
  } finally {
    await options.prod.releaseEnrichLock(token)
  }
}

function asRedisString(result: unknown): string | null {
  if (result == null) return null
  return typeof result === 'string' ? result : JSON.stringify(result)
}

export function assertUpstashMultiResults(payload: unknown): unknown[] {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const error = (payload as { error?: unknown }).error
    if (error) throw new Error(String(error))
  }
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { result?: unknown }).result)
      ? ((payload as { result: unknown[] }).result)
      : null
  if (!rows) throw new Error('upstash MULTI returned no result list')
  rows.forEach((row, index) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const error = (row as { error?: unknown }).error
      if (error) throw new Error(`upstash MULTI command ${index} failed: ${String(error)}`)
    }
    if (Array.isArray(row) && row[0]) {
      throw new Error(`upstash MULTI command ${index} failed: ${String(row[0])}`)
    }
  })
  return rows
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
  async function multi(commands: string[][]): Promise<unknown[]> {
    const response = await fetch(`${endpoint}/multi-exec`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    })
    if (!response.ok) {
      throw new Error(`upstash MULTI failed: ${response.status}`)
    }
    const body: unknown = await response.json()
    return assertUpstashMultiResults(body)
  }
  return {
    async getRaw(key: string) {
      return asRedisString(await command(['GET', key]))
    },
    async setRaw(key: string, value: string | null, pttlMs?: number) {
      const guarded = assertProdPromoteKey(key)
      if (value == null) {
        await command(['DEL', guarded])
        return
      }
      if (pttlMs != null && pttlMs > 0) {
        await command(['SET', guarded, value, 'PX', String(pttlMs)])
        return
      }
      await command(['SET', guarded, value])
    },
    async typeOf(key: string) {
      const result = await command(['TYPE', key])
      return typeof result === 'string' && result ? result : 'none'
    },
    async pttl(key: string) {
      const result = await command(['PTTL', key])
      const n = typeof result === 'number' ? result : Number(result)
      return Number.isFinite(n) ? n : -2
    },
    async dumpKey(key: string) {
      return asRedisString(await command(['GET', key]))
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
    async multiExec(commands: string[][]) {
      const guarded = commands.map((command) => {
        const next = [...command]
        if (next[1]) next[1] = assertProdPromoteKey(next[1])
        return next
      })
      return multi(guarded)
    },
    async casExec(keys: string[], expected: Array<string | null>, commands: string[][]) {
      const guardedKeys = keys.map((key) => assertProdPromoteKey(key))
      const guardedCommands = commands.map((row) => {
        const next = [...row]
        if (next[1]) next[1] = assertProdPromoteKey(next[1])
        return next
      })
      const args: string[] = [
        PROMOTE_WATCH_CAS_LUA,
        String(guardedKeys.length),
        ...guardedKeys,
        ...expected.map((dump) => (dump == null ? PROMOTE_CAS_NIL : dump)),
        String(guardedCommands.length),
      ]
      for (const row of guardedCommands) {
        args.push(String(row.length), ...row)
      }
      const result = await command(['EVAL', ...args])
      if (result !== 'OK') {
        throw new Error(`watched MULTI CAS failed: ${String(result)}`)
      }
      return [result]
    },
  }
}
