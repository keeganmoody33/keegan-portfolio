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
import type { StoredPressing } from './types.ts'

export const PROOF_KILL_ID = 8
export const PROOF_EXHAUSTED_ID = 9
export const PROOF_ENRICH_IDS = [573292, 240128, 567894] as const

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
])

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
  options: { ids?: number[] } = {}
): Promise<Record<string, unknown>> {
  const prefix = crateRedisKeys().prefix
  switch (action) {
    case 'inspect':
      return await inspectCrate(store)
    case 'overlap':
      return { prefix, ...(await proveOverlap(store)) }
    case 'kill':
      return { prefix, ...(await proveKill(store)) }
    case 'recover':
      return { prefix, ...(await proveRecover(store, options.ids ?? [])) }
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
    default: {
      const exhaustive: never = action
      return { prefix, error: `unhandled ${exhaustive}` }
    }
  }
}

async function proveOverlap(store: CrateStore): Promise<Record<string, unknown>> {
  const owner = randomLockToken()
  const locked = await store.acquireEnrichLock(60, owner)
  const second = await processEnrichmentQueue(
    {
      store,
      lockToken: randomLockToken(),
      takeFloorMs: 0,
      budgetMs: 1_000,
      fetchDiscogs: async () => {
        throw new Error('overlap proof must not fetch')
      },
    },
    1
  )
  const released = await store.releaseEnrichLock(owner)
  return {
    action: 'overlap',
    firstLock: locked,
    secondSkipped: second.skipped,
    secondProcessed: second.processed,
    released,
  }
}

async function proveKill(store: CrateStore): Promise<Record<string, unknown>> {
  await store.drop(PROOF_KILL_ID)
  await store.enqueue([PROOF_KILL_ID], { score: -1 })
  const nowMs = Date.now() + 1
  const taken = await store.takeDue(1, nowMs, 60)
  const overlapping = await store.takeDue(1, nowMs, 60)
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
    note: 'Call action=recover next. Inflight is cleared; the same id is taken again.',
  }
}

async function proveRecover(store: CrateStore, ids: number[] = []): Promise<Record<string, unknown>> {
  const id =
    ids.find((value) => value === PROOF_KILL_ID) ??
    (ids.length === 1 ? ids[0] : undefined) ??
    PROOF_KILL_ID
  await store.clearInflight(id)
  const recovered = await store.takeDue(1, Date.now() + 1, 60)
  const recoveredSameId = recovered[0] === id
  if (recoveredSameId) {
    await store.drop(id)
  } else if (recovered[0] != null) {
    await store.clearInflight(recovered[0])
  }
  return {
    action: 'recover',
    id,
    recovered,
    recoveredSameId,
    stillQueued: recoveredSameId ? undefined : await store.getQueue(),
  }
}

async function proveExhausted(store: CrateStore): Promise<Record<string, unknown>> {
  await store.drop(PROOF_EXHAUSTED_ID)
  let t = Date.now()
  const attempts: Array<number | null> = []
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const stored = await enrichPressing(PROOF_EXHAUSTED_ID, {
      store,
      now: () => t,
      fetchDiscogs: async () => {
        throw new Error('preview proof forced failure')
      },
    })
    attempts.push(stored.provenance.lastError?.attempts ?? null)
    const retryAt = Date.parse(stored.provenance.refreshAfter ?? '')
    t = Number.isFinite(retryAt) ? retryAt : t + 86_400_000
    if ((await store.getDead()).includes(PROOF_EXHAUSTED_ID)) break
  }
  await store.drop(PROOF_EXHAUSTED_ID)
  return {
    action: 'exhausted',
    id: PROOF_EXHAUSTED_ID,
    attempts,
    dead: await store.getDead(),
    inspect: (await store.getInspect()).filter((row) => row.releaseId === PROOF_EXHAUSTED_ID),
    lastError: (await store.getPressing(PROOF_EXHAUSTED_ID))?.provenance.lastError ?? null,
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
  return {
    action: 'resync',
    newIds: sync.newIds,
    queued: sync.queued,
    queueBefore: queuedBefore.length,
    queueAfter: queuedAfter.length,
    mbRequests: mb.requestCount,
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
    restored,
  }
}

async function proveAuth(store: CrateStore): Promise<Record<string, unknown>> {
  const identity = await proveDiscogsAuthWithBadToken()
  await store.drop(PROOF_KILL_ID)
  const stored = await enrichPressing(PROOF_KILL_ID, {
    store,
    fetchDiscogs: async () => {
      throw new DiscogsAuthError(identity.status === 403 ? 403 : 401)
    },
  })
  await store.drop(PROOF_KILL_ID)
  return {
    action: 'auth',
    identity,
    workerStoppedOnAuth: stored.provenance.lastError?.kind === 'auth',
    attempts: stored.provenance.lastError?.attempts ?? null,
    lastErrorKind: stored.provenance.lastError?.kind ?? null,
    how: identity.how,
  }
}

async function proveEnrich(store: CrateStore, ids: number[]): Promise<Record<string, unknown>> {
  if (ids.length === 0) {
    return { action: 'enrich', skipped: true, reason: 'no allowed ids' }
  }
  await store.enqueue(ids, { front: true, nowMs: Date.now() })
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
    skipped: result.skipped,
    stoppedOnAuth: result.stoppedOnAuth,
    stoppedOnRateLimit: result.stoppedOnRateLimit,
    mbRequests: result.mbRequests,
    pressings,
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
    how: 'Preview-only GET https://api.discogs.com/oauth/identity with an invalid Discogs token. The live DISCOGS_TOKEN and collection crawl were not used. Worker stop uses the same DiscogsAuthError(401|403) path as a real auth failure.',
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
