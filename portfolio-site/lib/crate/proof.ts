import {
  DiscogsAuthError,
  discogsHeaders,
  DISCOGS_USER_AGENT,
  readCachedCollection,
} from '../discogs.ts'
import { inspectCrate, type InspectSnapshot } from './backfill.ts'
import { enrichPressing, processEnrichmentQueue } from './enrich.ts'
import { crateRedisKeys, randomLockToken, type CrateStore } from './store.ts'
import { queueNewAndMissing } from './sync.ts'
import { createMusicBrainzClient } from './musicbrainz.ts'
import { storedPressingHasVisitorFacts } from './preserve.ts'
import type { StoredPressing } from './types.ts'

export const PROOF_KILL_ID = 8
export const PROOF_EXHAUSTED_ID = 9
export const PROOF_ENRICH_IDS = [573292, 240128, 567894] as const
export const PROOF_INFLIGHT_TTL_SECONDS = 2

export type ProofAction =
  | 'inspect'
  | 'overlap'
  | 'kill'
  | 'recover'
  | 'exhausted'
  | 'resync'
  | 'fail'
  | 'auth'
  | 'enrich'
  | 'cleanup'

const ACTIONS = new Set<ProofAction>([
  'inspect',
  'overlap',
  'kill',
  'recover',
  'exhausted',
  'resync',
  'fail',
  'auth',
  'enrich',
  'cleanup',
])

export function crateProofAllowed(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.VERCEL_ENV !== 'production'
}

export function parseProofAction(raw: string | null): ProofAction | null {
  if (!raw) return null
  return ACTIONS.has(raw as ProofAction) ? (raw as ProofAction) : null
}

export function parseProofIds(raw: string | null): number[] {
  if (!raw) return []
  const allowed = new Set<number>([...PROOF_ENRICH_IDS, PROOF_KILL_ID, PROOF_EXHAUSTED_ID])
  return raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((id) => allowed.has(id))
}

export async function runCrateProof(
  store: CrateStore,
  action: ProofAction,
  options: { ids?: number[]; env?: Record<string, string | undefined> } = {}
): Promise<Record<string, unknown>> {
  if (!crateProofAllowed(options.env ?? process.env)) {
    return { error: 'proof refused in production', refused: true }
  }
  const prefix = crateRedisKeys(options.env ?? process.env).prefix
  switch (action) {
    case 'inspect':
      return await inspectCrate(store)
    case 'overlap':
      return { prefix, ...(await proveOverlap(store)) }
    case 'kill':
      return { prefix, ...(await proveKill(store)) }
    case 'recover':
      return { prefix, ...(await proveRecover(store)) }
    case 'exhausted':
      return { prefix, ...(await proveExhausted(store)) }
    case 'resync':
      return { prefix, ...(await proveResync(store)) }
    case 'fail':
      return { prefix, ...(await proveFail(store)) }
    case 'auth':
      return { prefix, ...(await proveAuth(store)) }
    case 'enrich':
      return {
        prefix,
        ...(await proveEnrich(
          store,
          options.ids && options.ids.length > 0 ? options.ids : [...PROOF_ENRICH_IDS]
        )),
      }
    case 'cleanup':
      return { prefix, ...(await proveCleanup(store)) }
    default: {
      const exhaustive: never = action
      return { prefix, error: `unhandled ${exhaustive}` }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function proveOverlap(store: CrateStore): Promise<Record<string, unknown>> {
  await store.purgePressing(PROOF_KILL_ID)
  await store.enqueue([PROOF_KILL_ID], { score: -1 })
  let fetches = 0
  const fetchedIds: number[] = []
  const fetchDiscogs = async (releaseId: number) => {
    fetches += 1
    fetchedIds.push(releaseId)
    await sleep(250)
    throw new Error('overlap proof must not complete enrich')
  }
  const deps = {
    store,
    takeFloorMs: 0,
    budgetMs: 8_000,
    fetchDiscogs,
  }
  const [first, second] = await Promise.all([
    processEnrichmentQueue({ ...deps, lockToken: randomLockToken() }, 1),
    processEnrichmentQueue({ ...deps, lockToken: randomLockToken() }, 1),
  ])
  const processed = [...first.processed, ...second.processed]
  const uniqueProcessed = [...new Set(processed)]
  await store.purgePressing(PROOF_KILL_ID)
  return {
    action: 'overlap',
    firstSkipped: first.skipped,
    secondSkipped: second.skipped,
    firstProcessed: first.processed,
    secondProcessed: second.processed,
    fetches,
    fetchedIds,
    uniqueProcessed,
    noDoubleProcess: uniqueProcessed.length === processed.length,
    how: 'Two processEnrichmentQueue drains ran concurrently against the same Redis lock and queue. One worker holds the lock; inflight SET NX stops the same id being taken twice. Fetch count is the Discogs call count for this proof id.',
  }
}

async function proveKill(store: CrateStore): Promise<Record<string, unknown>> {
  await store.purgePressing(PROOF_KILL_ID)
  await store.enqueue([PROOF_KILL_ID], { score: -1 })
  const nowMs = Date.now() + 1
  const taken = await store.takeDue(1, nowMs, PROOF_INFLIGHT_TTL_SECONDS)
  const overlapping = await store.takeDue(1, nowMs, PROOF_INFLIGHT_TTL_SECONDS)
  const stolen = overlapping.filter((id) => id !== PROOF_KILL_ID)
  for (const id of stolen) {
    await store.clearInflight(id)
  }
  return {
    action: 'kill',
    id: PROOF_KILL_ID,
    taken,
    overlappingWhileInflight: overlapping,
    sameIdNotRetaken: !overlapping.includes(PROOF_KILL_ID),
    stolenReleased: stolen,
    inflightTtlSeconds: PROOF_INFLIGHT_TTL_SECONDS,
    clearedKillInflight: false,
    note: 'Inflight for id 8 was not cleared. Call action=recover after the TTL lapses.',
  }
}

async function proveRecover(store: CrateStore): Promise<Record<string, unknown>> {
  const waitMs = PROOF_INFLIGHT_TTL_SECONDS * 1000 + 500
  await sleep(waitMs)
  const recovered = await store.takeDue(1, Date.now() + 1, 60)
  const recoveredSameId = recovered[0] === PROOF_KILL_ID
  if (recoveredSameId) {
    await store.purgePressing(PROOF_KILL_ID)
  } else if (recovered[0] != null) {
    await store.clearInflight(recovered[0])
  }
  return {
    action: 'recover',
    id: PROOF_KILL_ID,
    waitedMs: waitMs,
    recovered,
    recoveredSameId,
    clearedInflightByHand: false,
    stillQueued: recoveredSameId ? undefined : await store.getQueue(),
    how: 'Waited for the inflight Redis TTL to expire, then takeDue again. clearInflight was not called for id 8.',
  }
}

async function proveExhausted(store: CrateStore): Promise<Record<string, unknown>> {
  await store.purgePressing(PROOF_EXHAUSTED_ID)
  const attempts: Array<number | null> = []
  const processed: number[][] = []
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await store.enqueue([PROOF_EXHAUSTED_ID], { score: -1 })
    const result = await processEnrichmentQueue(
      {
        store,
        takeFloorMs: 0,
        budgetMs: 8_000,
        fetchDiscogs: async () => {
          throw new Error('preview proof forced failure')
        },
      },
      1
    )
    processed.push(result.processed)
    const stored = await store.getPressing(PROOF_EXHAUSTED_ID)
    attempts.push(stored?.provenance.lastError?.attempts ?? null)
    if ((await store.getDead()).includes(PROOF_EXHAUSTED_ID)) break
    await store.drop(PROOF_EXHAUSTED_ID)
  }
  const inspect = (await store.getInspect()).filter(
    (row) => row.releaseId === PROOF_EXHAUSTED_ID
  )
  const dead = await store.getDead()
  const lastError = (await store.getPressing(PROOF_EXHAUSTED_ID))?.provenance.lastError ?? null
  await store.purgePressing(PROOF_EXHAUSTED_ID)
  return {
    action: 'exhausted',
    id: PROOF_EXHAUSTED_ID,
    attempts,
    processed,
    dead,
    inspect,
    lastError,
    how: 'Failures went through processEnrichmentQueue (take/nack/drop), not a direct enrichPressing loop. Proof id 9 was isolated by score -1 and dropped between attempts so jumping now() was not required.',
  }
}

async function proveResync(store: CrateStore): Promise<Record<string, unknown>> {
  const collection = await readCachedCollection()
  if (!collection) {
    return { action: 'resync', skipped: true, reason: 'no collection' }
  }
  const mb = createMusicBrainzClient()
  const queuedBefore = await store.getQueue()
  const sync = await queueNewAndMissing(store, await store.getSeen(), collection)
  const queuedAfter = await store.getQueue()
  const stored = await store.getPressing(573292)
  let reused = false
  if (
    stored &&
    storedPressingHasVisitorFacts(stored) &&
    stored.provenance.matchStatus === 'matched'
  ) {
    await enrichPressing(573292, { store, mb })
    reused = true
  }
  return {
    action: 'resync',
    newIds: sync.newIds,
    queued: sync.queued,
    queueBefore: queuedBefore.length,
    queueAfter: queuedAfter.length,
    mbRequests: mb.requestCount,
    reusedSuccessfulPressing: reused,
    bootsyNotRequeued: !sync.queued.includes(573292),
    how: 'queueNewAndMissing ran against the live collection, then enrichPressing(573292) reused last-good through the real MusicBrainz client. requestCount is that client’s actual HTTP counter. The live queue was not drained.',
  }
}

async function proveFail(store: CrateStore): Promise<Record<string, unknown>> {
  const releaseId = 573292
  const before = await store.getPressing(releaseId)
  if (!before) {
    return { action: 'fail', skipped: true, reason: 'no stored 573292' }
  }
  const nowMs = Date.now()
  const failed = await enrichPressing(releaseId, {
    store,
    now: () => nowMs,
    failRefresh: () => true,
  })
  const during = await store.getPressing(releaseId)
  let restored = false
  try {
    await enrichPressing(releaseId, { store, failRefresh: () => false })
    restored = true
  } catch {
    restored = false
  }
  return {
    action: 'fail',
    releaseId,
    verifiedAtBefore: before.provenance.verifiedAt ?? null,
    verifiedAtAfter: failed.provenance.verifiedAt ?? null,
    lastAttemptAtBefore: before.provenance.lastAttemptAt ?? null,
    lastAttemptAtAfter: failed.provenance.lastAttemptAt ?? null,
    verifiedAtUnchanged: before.provenance.verifiedAt === failed.provenance.verifiedAt,
    lastAttemptAdvanced:
      (failed.provenance.lastAttemptAt ?? '') > (before.provenance.lastAttemptAt ?? ''),
    lastError: failed.provenance.lastError,
    tracksKept: failed.tracks.length,
    lastGoodVisibleDuringFail: (during?.tracks.length ?? 0) > 0,
    restored,
  }
}

async function proveAuth(store: CrateStore): Promise<Record<string, unknown>> {
  const identity = await proveDiscogsAuthWithBadToken()
  await store.purgePressing(PROOF_KILL_ID)
  await store.enqueue([PROOF_KILL_ID], { score: -1 })
  const result = await processEnrichmentQueue(
    {
      store,
      takeFloorMs: 0,
      budgetMs: 8_000,
      fetchDiscogs: async () => {
        throw new DiscogsAuthError(identity.status === 403 ? 403 : 401)
      },
    },
    1
  )
  const stored = await store.getPressing(PROOF_KILL_ID)
  await store.purgePressing(PROOF_KILL_ID)
  return {
    action: 'auth',
    identity,
    workerStoppedOnAuth: result.stoppedOnAuth,
    processed: result.processed,
    attempts: stored?.provenance.lastError?.attempts ?? null,
    lastErrorKind: stored?.provenance.lastError?.kind ?? null,
    how: 'Preview-only GET https://api.discogs.com/oauth/identity with an invalid token classifies 401/403. The worker stop is processEnrichmentQueue stoppedOnAuth after DiscogsAuthError from fetchDiscogs — not a direct enrichPressing return.',
  }
}

async function proveEnrich(store: CrateStore, ids: number[]): Promise<Record<string, unknown>> {
  if (ids.length === 0) {
    return { action: 'enrich', skipped: true, reason: 'no allowed ids' }
  }
  await store.enqueue(ids, { nowMs: Date.now() })
  const mb = createMusicBrainzClient()
  const result = await processEnrichmentQueue(
    {
      store,
      mb,
      takeFloorMs: 0,
    },
    ids.length
  )
  const pressings: Record<string, unknown> = {}
  for (const id of ids) {
    const stored = await store.getPressing(id)
    pressings[String(id)] = stored ? summarizeStored(stored) : null
  }
  return {
    action: 'enrich',
    ids,
    processed: result.processed,
    completed: result.completed,
    failed: result.failed,
    unresolved: result.unresolved,
    skipped: result.skipped,
    stoppedOnAuth: result.stoppedOnAuth,
    stoppedOnRateLimit: result.stoppedOnRateLimit,
    mbRequests: result.mbRequests,
    pressings,
  }
}

async function proveCleanup(store: CrateStore): Promise<Record<string, unknown>> {
  await store.purgePressing(PROOF_KILL_ID)
  await store.purgePressing(PROOF_EXHAUSTED_ID)
  return {
    action: 'cleanup',
    purged: [PROOF_KILL_ID, PROOF_EXHAUSTED_ID],
    dead: await store.getDead(),
    unresolved: await store.getUnresolved(),
    queueHasProofIds: (await store.getQueue()).some(
      (id) => id === PROOF_KILL_ID || id === PROOF_EXHAUSTED_ID
    ),
  }
}

export async function proveDiscogsAuthWithBadToken(
  fetchImpl: typeof fetch = fetch
): Promise<{
  url: string
  status: number
  classified: 'auth' | 'other'
  how: string
}> {
  const url = 'https://api.discogs.com/oauth/identity'
  const response = await fetchImpl(url, {
    headers: {
      ...discogsHeaders('preview-proof-invalid-token'),
      'User-Agent': DISCOGS_USER_AGENT,
    },
    cache: 'no-store',
  })
  const classified = response.status === 401 || response.status === 403 ? 'auth' : 'other'
  return {
    url,
    status: response.status,
    classified,
    how: 'Preview-only GET https://api.discogs.com/oauth/identity with an invalid Discogs token. The live DISCOGS_TOKEN and collection crawl were not used.',
  }
}

function summarizeStored(pressing: StoredPressing): Record<string, unknown> {
  return {
    releaseId: pressing.releaseId,
    title: pressing.facts.title,
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
    checkedAt: pressing.provenance.checkedAt,
  }
}

export type { InspectSnapshot }
