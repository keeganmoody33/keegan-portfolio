import { collectionReleaseIds } from './sync.ts'
export { parseIdList, parsePositiveId } from './ids.ts'
import { fetchDiscogsReleaseDetail } from './discogs-release.ts'
import {
  CLI_BACKFILL_BUDGET_MS,
  ENRICH_BUDGET_MS,
  ENRICH_LOCK_SECONDS,
  ENRICH_TAKE_FLOOR_MS,
  applyDeadlineStop,
  classifyQueueOutcome,
  createEnrichLockHeartbeat,
  createForceSeriesId,
  enrichPressing,
  isBackfillSettled,
  isEnrichLockLostError,
  isWorkerDeadlineError,
  remainingBelowTakeFloor,
  remainingBudgetMs,
  shouldStopWalkOnRateLimit,
  type EnrichDeps,
} from './enrich.ts'
import { createMusicBrainzClient } from './musicbrainz.ts'
import { crateRedisKeys, selectEnrichLockToken, type CrateStore } from './store.ts'
import { AUTH_RETRY_MS, isoFromMs, storedPressingHasVisitorFacts } from './preserve.ts'
import type { BackfillState, DeadLetter, StoredPressing } from './types.ts'
import type { DiscogsCollection } from '../discogs.ts'
import { wikidataClientFor } from './wikidata.ts'

export const INSPECT_PRESSING_IDS = [573292, 240128, 567894] as const

export function parseBackfillBudgetMs(
  raw: string | undefined,
  fallback = CLI_BACKFILL_BUDGET_MS
): number {
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}

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
    settled: [],
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

export function migrateSettledIds(previous: BackfillState, ids: number[]): number[] {
  if (Array.isArray(previous.settled)) {
    const seen = new Set<number>()
    const settled: number[] = []
    for (const id of previous.settled) {
      if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
        settled.push(id)
        seen.add(id)
      }
    }
    return settled
  }
  void ids
  return []
}

export function remainingBackfillIds(
  ids: number[],
  settled: Iterable<number>,
  dead: Iterable<number>,
  retry = false,
  retryOnly?: Iterable<number> | null
): number[] {
  if (retry && retryOnly) {
    const allow = new Set(retryOnly)
    return ids.filter((id) => allow.has(id))
  }
  if (retry) return [...ids]
  const settledSet = new Set(settled)
  const deadSet = new Set(dead)
  return ids.filter((id) => !settledSet.has(id) && !deadSet.has(id))
}

const RETRY_LAST_ERROR_KINDS = new Set(['too_slow', 'rate_limit', 'unavailable'])

export async function retryBackfillTargets(
  store: CrateStore,
  collectionIds: number[] = []
): Promise<number[]> {
  const dead = await store.getDead()
  const inspect = await store.getInspect()
  const retryInspect = inspect
    .filter((row) => RETRY_LAST_ERROR_KINDS.has(row.kind))
    .map((row) => row.releaseId)
  const pending: number[] = []
  if (collectionIds.length > 0) {
    const pressings = await store.getPressings(collectionIds)
    for (const id of collectionIds) {
      const pressing = pressings.get(id)
      if (!pressing) continue
      const kind = pressing.provenance.lastError?.kind
      if (!kind || !RETRY_LAST_ERROR_KINDS.has(kind)) continue
      if (!isBackfillSettled(pressing)) pending.push(id)
    }
  }
  return [...new Set([...dead, ...retryInspect, ...pending])]
}

function refreshAfterMs(pressing: StoredPressing | null): number {
  if (!pressing?.provenance.refreshAfter) return NaN
  return Date.parse(pressing.provenance.refreshAfter)
}

export async function runBackfill(
  deps: EnrichDeps & { collection: DiscogsCollection },
  options: { limit?: number; retry?: boolean; ids?: number[] } = {}
): Promise<BackfillResult> {
  const store = deps.store
  const now = deps.now ?? Date.now
  const started = now()
  const collectionIds = collectionReleaseIds(deps.collection)
  const ids = options.ids && options.ids.length > 0 ? options.ids : collectionIds
  const targeted = Boolean(options.ids && options.ids.length > 0)
  const retryOnly =
    options.retry && !targeted ? await retryBackfillTargets(store, collectionIds) : null
  const previous = (await store.getBackfill()) ?? emptyBackfillPrevious(started)
  const settled = new Set(migrateSettledIds(previous, collectionIds))
  const prefix = crateRedisKeys().prefix

  const snapshotCounts = async (
    extra: Partial<BackfillResult> & Pick<
      BackfillResult,
      'processed' | 'completedThis' | 'failedThis' | 'unresolvedThis' | 'skipped' | 'stoppedOnAuth' | 'stoppedOnRateLimit'
    >,
    discogsThis: number,
    mbThis: number
  ): Promise<BackfillResult> => {
    const dead = await store.getDead()
    const unresolvedSet = await store.getUnresolved()
    const elapsedMs = Math.max(1, now() - started)
    const minutes = elapsedMs / 60_000
    const remainingList = remainingBackfillIds(ids, settled, dead, options.retry, retryOnly)
    const remaining = remainingList.length
    const completedThis = extra.completedThis
    const completed = previous.completed + completedThis
    const releasesPerMin = completedThis > 0 ? completedThis / minutes : 0
    const estimatedRemainingMs =
      releasesPerMin > 0 ? Math.round((remaining / releasesPerMin) * 60_000) : null
    const settledList = [...settled]
    const backfill: BackfillState = {
      cursor: settledList.length,
      settled: settledList,
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

  const emptyExtra = {
    processed: [] as number[],
    completedThis: 0,
    failedThis: 0,
    unresolvedThis: 0,
    skipped: false,
    stoppedOnAuth: false,
    stoppedOnRateLimit: false,
  }

  const remainingNow = remainingBackfillIds(
    ids,
    settled,
    await store.getDead(),
    options.retry,
    retryOnly
  )
  if (remainingNow.length === 0) {
    return snapshotCounts(emptyExtra, 0, 0)
  }

  const token = selectEnrichLockToken(deps.lockToken)
  const lockTtl = deps.lockTtlSeconds ?? ENRICH_LOCK_SECONDS
  const locked = await store.acquireEnrichLock(lockTtl, token)
  if (!locked) {
    try {
      await store.releaseEnrichLock(token)
    } catch {
      // lock ttl still expires
    }
    const dead = await store.getDead()
    const remaining = remainingBackfillIds(ids, settled, dead, options.retry, retryOnly).length
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
      backfill: { ...previous, settled: [...settled], cursor: settled.size },
      completedThis: 0,
      failedThis: 0,
      unresolvedThis: 0,
    }
  }

  const takeFloorMs = deps.takeFloorMs ?? ENRICH_TAKE_FLOOR_MS
  const heartbeat = createEnrichLockHeartbeat(store, token, lockTtl, now)
  const deadlineMs = deps.deadlineMs ?? started + (deps.budgetMs ?? ENRICH_BUDGET_MS)
  const mb = deps.mb ?? createMusicBrainzClient({ now: deps.now, deadlineMs, onRequest: heartbeat })
  const wikidataClient =
    deps.wikidataClient ??
    (deps.wikidata ? wikidataClientFor({ now: deps.now, ...deps.wikidata }) : undefined)
  const baseFetch = deps.fetchDiscogs ?? ((releaseId: number) => fetchDiscogsReleaseDetail(releaseId))
  let discogsThis = 0
  const wrappedFetch = async (releaseId: number) => {
    discogsThis += 1
    return baseFetch(releaseId)
  }
  const mbStart = mb.requestCount
  const cap = options.limit ?? Number.POSITIVE_INFINITY
  const forceSeriesId =
    options.retry || deps.forceRefresh
      ? (deps.forceSeriesId ?? createForceSeriesId())
      : deps.forceSeriesId
  const processed: number[] = []
  let completedThis = 0
  let failedThis = 0
  let unresolvedThis = 0
  let stoppedOnAuth = false
  let stoppedOnRateLimit = false
  const deadAtStart = new Set(await store.getDead())

  const retryOnlySet = retryOnly ? new Set(retryOnly) : null

  try {
    for (const releaseId of ids) {
      if (processed.length >= cap) break
      if (remainingBelowTakeFloor(remainingBudgetMs(deadlineMs, now()), takeFloorMs)) break
      if (retryOnlySet) {
        if (!retryOnlySet.has(releaseId)) continue
        settled.delete(releaseId)
      } else {
        if (settled.has(releaseId) && !options.retry) continue
        if (options.retry) settled.delete(releaseId)
        if (!options.retry && deadAtStart.has(releaseId)) continue
      }

      const stored = await store.getPressing(releaseId)
      if (remainingBelowTakeFloor(remainingBudgetMs(deadlineMs, now()), takeFloorMs)) break
      const retryAt = refreshAfterMs(stored)
      if (
        stored?.provenance.lastError &&
        Number.isFinite(retryAt) &&
        retryAt > now()
      ) {
        if (shouldStopWalkOnRateLimit(stored)) {
          stoppedOnRateLimit = true
          break
        }
        continue
      }

      try {
        await heartbeat()
        const pressing = await enrichPressing(releaseId, {
          ...deps,
          mb,
          wikidataClient,
          fetchDiscogs: wrappedFetch,
          deadlineMs,
          forceRefresh: Boolean(options.retry || deps.forceRefresh),
          forceSeriesId,
          onLockHeartbeat: heartbeat,
        })
        processed.push(releaseId)
        const kind = pressing.provenance.lastError?.kind
        if (kind === 'auth') {
          stoppedOnAuth = true
          await store.nack(releaseId, now() + AUTH_RETRY_MS)
          break
        }
        if (shouldStopWalkOnRateLimit(pressing)) {
          stoppedOnRateLimit = true
          const rateRetry = Date.parse(pressing.provenance.refreshAfter)
          await store.nack(releaseId, Number.isFinite(rateRetry) ? rateRetry : now() + 60 * 60 * 1000)
          break
        }
        if (!isBackfillSettled(pressing)) {
          const nackAt = Date.parse(pressing.provenance.refreshAfter)
          await store.nack(releaseId, Number.isFinite(nackAt) ? nackAt : now() + 60 * 60 * 1000)
          continue
        }
        const outcome = classifyQueueOutcome(pressing)
        if (kind !== 'exhausted') {
          await store.unmarkDead(releaseId)
          deadAtStart.delete(releaseId)
        }
        await store.ack(releaseId)
        if (outcome === 'completed') {
          completedThis += 1
        } else if (kind === 'exhausted' || outcome === 'failed') {
          failedThis += 1
        } else {
          unresolvedThis += 1
        }
        settled.add(releaseId)
      } catch (error) {
        if (isEnrichLockLostError(error)) {
          await store.nack(releaseId, now())
          break
        }
        if (isWorkerDeadlineError(error)) {
          const stop = await applyDeadlineStop(store, releaseId, now())
          if (stop.tooSlow) {
            processed.push(releaseId)
            unresolvedThis += 1
            settled.add(releaseId)
          }
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
