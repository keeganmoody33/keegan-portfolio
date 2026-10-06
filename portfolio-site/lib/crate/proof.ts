import {
  DiscogsAuthError,
  readCachedCollection,
} from '../discogs.ts'
import { inspectCrate, type InspectSnapshot } from './backfill.ts'
import { enrichPressing, processEnrichmentQueue } from './enrich.ts'
import {
  DISCOGS_IDENTITY_URL,
  probeDiscogsIdentity,
  type DiscogsReleaseDetail,
} from './discogs-release.ts'
import { AUTH_RETRY_MS, storedPressingHasVisitorFacts } from './preserve.ts'
import { crateRedisKeys, randomLockToken, type CrateStore } from './store.ts'
import { queueNewAndMissing } from './sync.ts'
import { createMusicBrainzClient, type MusicBrainzClient } from './musicbrainz.ts'
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

function throwingMusicBrainzClient(): MusicBrainzClient {
  const fail = async () => {
    throw new Error('preview proof musicbrainz failure')
  }
  return {
    requestCount: 0,
    lookupDiscogsReleaseUrl: fail,
    searchReleaseByBarcode: fail,
    searchReleaseByCatno: fail,
    searchReleaseByArtistTitle: fail,
    getRelease: fail,
    getRecording: fail,
  }
}

function proofDiscogsDetail(releaseId: number): DiscogsReleaseDetail {
  return {
    id: releaseId,
    title: 'preview proof stub',
    artist: 'lecturesfrom',
    year: 2026,
    released: '2026',
    country: null,
    thumb: '',
    cover: '',
    format: 'Vinyl',
    label: 'lf',
    catno: `lf-${releaseId}`,
    barcode: null,
    notes: null,
    discogsUrl: `https://www.discogs.com/release/${releaseId}`,
    tracklist: [{ position: 'A1', title: 'Proof', duration: '1:00', type_: 'track' }],
  }
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
  await store.enqueue([PROOF_KILL_ID], { score: -1 })
  const nowMs = Date.now() + 1
  const [left, right] = await Promise.all([
    store.takeDue(1, nowMs, 30),
    store.takeDue(1, nowMs, 30),
  ])
  const nxTaken = [...left, ...right]
  const nxKillTaken = nxTaken.filter((id) => id === PROOF_KILL_ID)
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
    lockExclusion: first.skipped !== second.skipped,
    inflightNx: {
      left,
      right,
      killTakenCount: nxKillTaken.length,
      exclusive: nxKillTaken.length <= 1,
    },
    how: 'Concurrent processEnrichmentQueue drains prove enrich-lock exclusion only (the loser skips before takeDue). Concurrent store.takeDue on the same id proves inflight SET NX exclusion.',
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
  const verifiedAt: Array<string | null> = []
  const processed: number[][] = []
  const stages: Array<string | null> = []
  const mb = throwingMusicBrainzClient()
  for (let attempt = 0; attempt < 7; attempt += 1) {
    if ((await store.getDead()).includes(PROOF_EXHAUSTED_ID)) {
      const stored = await store.getPressing(PROOF_EXHAUSTED_ID)
      attempts.push(stored?.provenance.lastError?.attempts ?? null)
      verifiedAt.push(stored?.provenance.verifiedAt ?? null)
      stages.push(stored?.lifecycles?.match.lastError ? 'match' : stored?.checkpoint?.stage ?? null)
      processed.push([])
      continue
    }
    await store.enqueue([PROOF_EXHAUSTED_ID], { score: -1 })
    const result = await processEnrichmentQueue(
      {
        store,
        mb,
        takeFloorMs: 0,
        budgetMs: 8_000,
        fetchDiscogs: async (releaseId) => proofDiscogsDetail(releaseId),
      },
      1
    )
    processed.push(result.processed)
    const stored = await store.getPressing(PROOF_EXHAUSTED_ID)
    attempts.push(stored?.provenance.lastError?.attempts ?? null)
    verifiedAt.push(stored?.provenance.verifiedAt ?? null)
    stages.push(stored?.lifecycles?.match.lastError ? 'match' : stored?.checkpoint?.stage ?? null)
    if ((await store.getDead()).includes(PROOF_EXHAUSTED_ID)) {
      continue
    }
    await store.drop(PROOF_EXHAUSTED_ID)
  }
  const inspect = (await store.getInspect()).filter(
    (row) => row.releaseId === PROOF_EXHAUSTED_ID
  )
  const dead = await store.getDead()
  const last = await store.getPressing(PROOF_EXHAUSTED_ID)
  const lastError = last?.provenance.lastError ?? null
  const factsTitle = last?.facts.title ?? null
  await store.purgePressing(PROOF_EXHAUSTED_ID)
  return {
    action: 'exhausted',
    id: PROOF_EXHAUSTED_ID,
    attempts,
    verifiedAt,
    verifiedAtUnchanged: verifiedAt.length > 0 && verifiedAt.every((value) => value === verifiedAt[0]),
    processed,
    stages,
    factsTitle,
    dead,
    inspect,
    lastError,
    how: 'Discogs returned a stub (pressing stage ok). MusicBrainz threw at match. Failures went through processEnrichmentQueue seven times. Proof id 9 was isolated by score -1 and dropped between attempts so jumping now() was not required.',
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
    authRetryMs: AUTH_RETRY_MS,
    how: 'Identity 401 is classified by probeDiscogsIdentity in discogs-release.ts (errorForDiscogsStatus). The worker stop is processEnrichmentQueue stoppedOnAuth after DiscogsAuthError from fetchDiscogs — not a direct enrichPressing return. Auth nacks AUTH_RETRY_MS (minutes), not TERMINAL_REFRESH_MS.',
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
  const bootsyBefore = await store.getPressing(573292)
  const verifiedAtBefore = bootsyBefore?.provenance.verifiedAt ?? null
  const hadFailError = Boolean(bootsyBefore?.provenance.lastError)
  let restored = false
  if (hadFailError) {
    try {
      await enrichPressing(573292, { store, failRefresh: () => false })
      restored = true
    } catch {
      restored = false
    }
  }
  const bootsyAfter = await store.getPressing(573292)
  const queue = await store.getQueue()
  const dead = await store.getDead()
  const unresolved = await store.getUnresolved()
  const leftoverProofIds = [...new Set([...queue, ...dead, ...unresolved])].filter(
    (id) => id === PROOF_KILL_ID || id === PROOF_EXHAUSTED_ID
  )
  return {
    action: 'cleanup',
    purged: [PROOF_KILL_ID, PROOF_EXHAUSTED_ID],
    leftoverProofIds,
    leftoverMarked: leftoverProofIds.length === 0 ? 'purged' : 'still present — preview proof stubs',
    bootsyVerifiedAtBefore: verifiedAtBefore,
    bootsyVerifiedAtAfter: bootsyAfter?.provenance.verifiedAt ?? null,
    bootsyLastErrorAfter: bootsyAfter?.provenance.lastError ?? null,
    bootsyRestored: restored,
    dead,
    unresolved,
    queueHasProofIds: leftoverProofIds.length > 0,
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
  const probed = await probeDiscogsIdentity({
    fetchImpl,
    token: 'preview-proof-invalid-token',
  })
  return {
    url: probed.url,
    status: probed.status,
    classified: probed.classified,
    how: `Preview-only GET ${DISCOGS_IDENTITY_URL} classified by probeDiscogsIdentity / errorForDiscogsStatus in discogs-release.ts. The live DISCOGS_TOKEN and collection crawl were not used.`,
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
