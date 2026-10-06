import { collectionReleaseIds } from './sync.ts'
import { fetchDiscogsReleaseDetail } from './discogs-release.ts'
import {
  ENRICH_BUDGET_MS,
  ENRICH_LOCK_SECONDS,
  ENRICH_TAKE_FLOOR_MS,
  classifyQueueOutcome,
  enrichPressing,
  isBackfillSettled,
  isWorkerDeadlineError,
  type EnrichDeps,
} from './enrich.ts'
import { createMusicBrainzClient } from './musicbrainz.ts'
import { crateRedisKeys, randomLockToken, type CrateStore } from './store.ts'
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
  remainingIsEstimate: false
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
  completedThis: number
  failedThis: number
  unresolvedThis: number
}

function emptyBackfillPrevious(started: number): BackfillState {
  return {
    cursor: 0,
    startedAt: isoFromMs(started),
    updatedAt: isoFromMs(started),
    completed: 0,
    unresolved: 0,
    failed: 0,
    discogsRequests: 0,
    mbRequests: 0,
    status: 'running',
  }
}

export async function runBackfill(
  deps: EnrichDeps & { collection: DiscogsCollection },
  options: { limit?: number } = {}
): Promise<BackfillResult> {
  const store = deps.store
  const now = deps.now ?? Date.now
  const started = now()
  const ids = collectionReleaseIds(deps.collection)
  const previous = (await store.getBackfill()) ?? emptyBackfillPrevious(started)
  const cursor = previous.cursor
  const prefix = crateRedisKeys().prefix

  const snapshotCounts = async (nextCursor: number, extra: Partial<BackfillResult> & Pick<
    BackfillResult,
    'processed' | 'completedThis' | 'failedThis' | 'unresolvedThis' | 'skipped' | 'stoppedOnAuth' | 'stoppedOnRateLimit'
  >, discogsThis: number, mbThis: number): Promise<BackfillResult> => {
    const dead = await store.getDead()
    const unresolvedSet = await store.getUnresolved()
    const elapsedMs = Math.max(1, now() - started)
    const minutes = elapsedMs / 60_000
    const remaining = Math.max(0, ids.length - nextCursor)
    const completedThis = extra.completedThis
    const completed = previous.completed + completedThis
    const releasesPerMin = completedThis > 0 ? completedThis / minutes : 0
    const estimatedRemainingMs =
      releasesPerMin > 0 ? Math.round((remaining / releasesPerMin) * 60_000) : null
    const backfill: BackfillState = {
      cursor: nextCursor,
      startedAt: previous.startedAt,
      updatedAt: isoFromMs(now()),
      completed,
      unresolved: unresolvedSet.length,
      failed: dead.length,
      discogsRequests: previous.discogsRequests + discogsThis,
      mbRequests: previous.mbRequests + mbThis,
      status: extra.stoppedOnAuth
        ? 'auth_stop'
        : extra.stoppedOnRateLimit
          ? 'rate_limit'
          : remaining === 0
            ? 'idle'
            : 'running',
    }
    await store.setBackfill(backfill)
    return {
      prefix,
      processed: extra.processed,
      completed,
      unresolved: unresolvedSet.length,
      failed: dead.length,
      remaining,
      remainingIsEstimate: false,
      elapsedMs,
      releasesPerMin,
      discogsRequestsPerMin: discogsThis / minutes,
      mbRequestsPerMin: mbThis / minutes,
      discogsRequests: discogsThis,
      mbRequests: mbThis,
      estimatedRemainingMs,
      stoppedOnAuth: extra.stoppedOnAuth,
      stoppedOnRateLimit: extra.stoppedOnRateLimit,
      skipped: extra.skipped,
      backfill,
      completedThis,
      failedThis: extra.failedThis,
      unresolvedThis: extra.unresolvedThis,
    }
  }

  if (cursor >= ids.length) {
    return snapshotCounts(
      cursor,
      {
        processed: [],
        completedThis: 0,
        failedThis: 0,
        unresolvedThis: 0,
        skipped: false,
        stoppedOnAuth: false,
        stoppedOnRateLimit: false,
      },
      0,
      0
    )
  }

  const token = deps.lockToken ?? randomLockToken()
  const lockTtl = deps.lockTtlSeconds ?? ENRICH_LOCK_SECONDS
  const locked = await store.acquireEnrichLock(lockTtl, token)
  if (!locked) {
    const remaining = Math.max(0, ids.length - cursor)
    const elapsedMs = Math.max(1, now() - started)
    return {
      prefix,
      processed: [],
      completed: previous.completed,
      unresolved: previous.unresolved,
      failed: previous.failed,
      remaining,
      remainingIsEstimate: false,
      elapsedMs,
      releasesPerMin: 0,
      discogsRequestsPerMin: 0,
      mbRequestsPerMin: 0,
      discogsRequests: 0,
      mbRequests: 0,
      estimatedRemainingMs: null,
      stoppedOnAuth: false,
      stoppedOnRateLimit: false,
      skipped: true,
      backfill: previous,
      completedThis: 0,
      failedThis: 0,
      unresolvedThis: 0,
    }
  }

  const mb = deps.mb ?? createMusicBrainzClient({ now: deps.now })
  const baseFetch = deps.fetchDiscogs ?? ((releaseId: number) => fetchDiscogsReleaseDetail(releaseId))
  let discogsThis = 0
  const wrappedFetch = async (releaseId: number) => {
    discogsThis += 1
    return baseFetch(releaseId)
  }
  const mbStart = mb.requestCount
  const takeFloorMs = deps.takeFloorMs ?? ENRICH_TAKE_FLOOR_MS
  const deadlineMs = deps.deadlineMs ?? started + (deps.budgetMs ?? ENRICH_BUDGET_MS)
  const cap = options.limit ?? Number.POSITIVE_INFINITY
  const processed: number[] = []
  let completedThis = 0
  let failedThis = 0
  let unresolvedThis = 0
  let nextCursor = cursor
  let stoppedOnAuth = false
  let stoppedOnRateLimit = false

  try {
    while (processed.length < cap && nextCursor < ids.length) {
      if (now() + takeFloorMs >= deadlineMs) break
      const releaseId = ids[nextCursor]
      if (releaseId == null) break
      try {
        const pressing = await enrichPressing(releaseId, {
          ...deps,
          mb,
          fetchDiscogs: wrappedFetch,
          deadlineMs,
        })
        processed.push(releaseId)
        const kind = pressing.provenance.lastError?.kind
        if (kind === 'auth') {
          stoppedOnAuth = true
          break
        }
        if (kind === 'rate_limit') {
          stoppedOnRateLimit = true
          break
        }
        if (!isBackfillSettled(pressing)) {
          break
        }
        const outcome = classifyQueueOutcome(pressing)
        if (outcome === 'completed') completedThis += 1
        else if (kind === 'exhausted' || outcome === 'failed') failedThis += 1
        else unresolvedThis += 1
        nextCursor += 1
      } catch (error) {
        if (isWorkerDeadlineError(error)) {
          break
        }
        processed.push(releaseId)
        break
      }
    }
  } finally {
    try {
      await store.releaseEnrichLock(token)
    } catch {
      // lock ttl still expires
    }
  }

  const mbThis = Math.max(0, mb.requestCount - mbStart)
  return snapshotCounts(
    nextCursor,
    {
      processed,
      completedThis,
      failedThis,
      unresolvedThis,
      skipped: false,
      stoppedOnAuth,
      stoppedOnRateLimit,
    },
    discogsThis,
    mbThis
  )
}
