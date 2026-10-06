import { collectionReleaseIds } from './sync.ts'
import { processEnrichmentQueue, type EnrichDeps } from './enrich.ts'
import { crateRedisKeys, type CrateStore } from './store.ts'
import { isoFromMs } from './preserve.ts'
import type { BackfillState, DeadLetter } from './types.ts'
import type { DiscogsCollection } from '../discogs.ts'

export type InspectSnapshot = {
  prefix: string
  queue: number[]
  dead: number[]
  unresolved: number[]
  inspect: DeadLetter[]
  backfill: BackfillState | null
}

export async function inspectCrate(
  store: CrateStore,
  env: Record<string, string | undefined> = process.env
): Promise<InspectSnapshot> {
  const keys = crateRedisKeys(env)
  const [queue, dead, unresolved, inspect, backfill] = await Promise.all([
    store.getQueue(),
    store.getDead(),
    store.getUnresolved(),
    store.getInspect(),
    store.getBackfill(),
  ])
  return {
    prefix: keys.prefix,
    queue,
    dead,
    unresolved,
    inspect,
    backfill,
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

  let discogsRequests = previous.discogsRequests
  const fetchDiscogs = deps.fetchDiscogs
  const wrappedFetch = fetchDiscogs
    ? async (releaseId: number) => {
        discogsRequests += 1
        return fetchDiscogs(releaseId)
      }
    : undefined

  const mbStart = deps.mb?.requestCount ?? 0
  const result = await processEnrichmentQueue(
    { ...deps, fetchDiscogs: wrappedFetch ?? deps.fetchDiscogs },
    options.limit
  )
  const mbRequests = previous.mbRequests + Math.max(0, (deps.mb?.requestCount ?? mbStart) - mbStart)

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
