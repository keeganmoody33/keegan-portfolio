import { collectionReleaseIds } from './sync.ts'
import { fetchDiscogsReleaseDetail } from './discogs-release.ts'
import { processEnrichmentQueue, type EnrichDeps } from './enrich.ts'
import { createMusicBrainzClient } from './musicbrainz.ts'
import { crateRedisKeys, type CrateStore } from './store.ts'
import { isoFromMs, storedPressingHasVisitorFacts } from './preserve.ts'
import type { BackfillState, DeadLetter, StoredPressing } from './types.ts'
import type { DiscogsCollection } from '../discogs.ts'

export const INSPECT_PRESSING_IDS = [573292, 240128, 567894] as const

export type InspectPressingDump = {
  releaseId: number
  title: string
  hasVisitorFacts: boolean
  matchStatus: string
  verifiedAt: string | null
  lastAttemptAt: string | null
  lastError: StoredPressing['provenance']['lastError']
  description: string | null
  tracks: Array<{ position: string; title: string; match: string }>
  coverage: StoredPressing['coverage'] | null
  checkedAt: string
}

export type InspectSnapshot = {
  prefix: string
  queue: number[]
  dead: number[]
  unresolved: number[]
  inspect: DeadLetter[]
  backfill: BackfillState | null
  pressings: Record<string, InspectPressingDump | null>
}

function dumpPressing(pressing: StoredPressing): InspectPressingDump {
  return {
    releaseId: pressing.releaseId,
    title: pressing.facts.title,
    hasVisitorFacts: storedPressingHasVisitorFacts(pressing),
    matchStatus: pressing.provenance.matchStatus,
    verifiedAt: pressing.provenance.verifiedAt ?? null,
    lastAttemptAt: pressing.provenance.lastAttemptAt ?? null,
    lastError: pressing.provenance.lastError,
    description: pressing.description?.text ?? null,
    tracks: pressing.tracks.map((track) => ({
      position: track.position,
      title: track.title,
      match: track.recording.matchStatus,
    })),
    coverage: pressing.coverage ?? null,
    checkedAt: pressing.provenance.checkedAt,
  }
}

export async function inspectCrate(
  store: CrateStore,
  env: Record<string, string | undefined> = process.env
): Promise<InspectSnapshot> {
  const keys = crateRedisKeys(env)
  const [queue, dead, unresolved, inspect, backfill, pressings] = await Promise.all([
    store.getQueue(),
    store.getDead(),
    store.getUnresolved(),
    store.getInspect(),
    store.getBackfill(),
    store.getPressings([...INSPECT_PRESSING_IDS]),
  ])
  const dumped: Record<string, InspectPressingDump | null> = {}
  for (const id of INSPECT_PRESSING_IDS) {
    const stored = pressings.get(id)
    dumped[String(id)] = stored ? dumpPressing(stored) : null
  }
  return {
    prefix: keys.prefix,
    queue,
    dead,
    unresolved,
    inspect,
    backfill,
    pressings: dumped,
  }
}

export type BackfillResult = {
  prefix: string
  processed: number[]
  completed: number
  unresolved: number
  failed: number
  remaining: number
  elapsedMs: number
  releasesPerMin: number
  discogsRequestsPerMin: number
  mbRequestsPerMin: number
  discogsRequests: number
  mbRequests: number
  estimatedRemainingMs: number | null
  stoppedOnAuth: boolean
  stoppedOnRateLimit: boolean
  skipped: boolean
  backfill: BackfillState
}

export async function runBackfill(
  deps: EnrichDeps & { collection: DiscogsCollection },
  options: { limit?: number } = {}
): Promise<BackfillResult> {
  const store = deps.store
  const now = deps.now ?? Date.now
  const started = now()
  const ids = collectionReleaseIds(deps.collection)
  const previous = (await store.getBackfill()) ?? {
    cursor: 0,
    startedAt: isoFromMs(started),
    updatedAt: isoFromMs(started),
    completed: 0,
    unresolved: 0,
    failed: 0,
    discogsRequests: 0,
    mbRequests: 0,
    status: 'running' as const,
  }
  const cursor = previous.cursor
  const remainingIds = ids.slice(cursor)
  if (remainingIds.length > 0) {
    await store.enqueue(remainingIds, { front: false, nowMs: started })
  }

  const mb = deps.mb ?? createMusicBrainzClient({ now: deps.now })
  const baseFetch = deps.fetchDiscogs ?? ((releaseId: number) => fetchDiscogsReleaseDetail(releaseId))
  let discogsRequests = previous.discogsRequests
  const wrappedFetch = async (releaseId: number) => {
    discogsRequests += 1
    return baseFetch(releaseId)
  }
  const mbStart = mb.requestCount
  const result = await processEnrichmentQueue(
    { ...deps, mb, fetchDiscogs: wrappedFetch },
    options.limit
  )
  const mbRequests = previous.mbRequests + Math.max(0, mb.requestCount - mbStart)

  const dead = await store.getDead()
  const unresolved = await store.getUnresolved()
  const processed = result.processed.length
  const nextCursor = Math.min(ids.length, cursor + processed)
  const elapsedMs = Math.max(1, now() - started)
  const minutes = elapsedMs / 60_000
  const completed = previous.completed + processed
  const remaining = Math.max(0, ids.length - nextCursor)
  const releasesPerMin = completed > 0 ? processed / minutes : 0
  const estimatedRemainingMs =
    releasesPerMin > 0 ? Math.round((remaining / releasesPerMin) * 60_000) : null

  const backfill: BackfillState = {
    cursor: nextCursor,
    startedAt: previous.startedAt,
    updatedAt: isoFromMs(now()),
    completed,
    unresolved: unresolved.length,
    failed: dead.length,
    discogsRequests,
    mbRequests,
    status: result.stoppedOnAuth
      ? 'auth_stop'
      : result.stoppedOnRateLimit
        ? 'rate_limit'
        : remaining === 0
          ? 'idle'
          : 'running',
  }
  await store.setBackfill(backfill)

  return {
    prefix: crateRedisKeys().prefix,
    processed: result.processed,
    completed,
    unresolved: unresolved.length,
    failed: dead.length,
    remaining,
    elapsedMs,
    releasesPerMin,
    discogsRequestsPerMin: discogsRequests / minutes,
    mbRequestsPerMin: mbRequests / minutes,
    discogsRequests,
    mbRequests,
    estimatedRemainingMs,
    stoppedOnAuth: result.stoppedOnAuth,
    stoppedOnRateLimit: result.stoppedOnRateLimit,
    skipped: result.skipped,
    backfill,
  }
}
