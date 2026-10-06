import {
  DISCOGS_SNAPSHOT_TTL_MS,
  getDefaultRedisDurableStore,
  isSnapshotStale,
  type DurableStore,
} from '../discogs-store.ts'
import { isDiscogsAuthError, type DiscogsClientOptions } from '../discogs.ts'
import {
  ENRICH_LOCK_SECONDS,
  processEnrichmentQueue,
  remainingBudgetMs,
  skippedAuthQueueResult,
  workerDeadlineMs,
  type EnrichDeps,
  type EnrichQueueResult,
} from './enrich.ts'
import { getDefaultCrateStore, type CrateStore } from './store.ts'
import { queueNewAndMissing } from './sync.ts'

export type KeepCollectionResult = {
  refreshedCollection: boolean
  visitEnrich: EnrichQueueResult | null
}

async function refreshStaleCollection(
  durable: DurableStore,
  options: DiscogsClientOptions,
  now: () => number,
  deadlineMs: number
): Promise<'fresh' | 'refreshed' | 'auth'> {
  if (now() >= deadlineMs) return 'fresh'
  let fetchedAt: number | null = null
  try {
    const snapshot = await durable.get()
    fetchedAt = snapshot?.meta?.fetchedAt ?? null
  } catch {
    fetchedAt = null
  }
  if (!isSnapshotStale(fetchedAt, now(), DISCOGS_SNAPSHOT_TTL_MS)) return 'fresh'
  try {
    const { refreshDurableCollection } = await import('../discogs.ts')
    await refreshDurableCollection(durable, options, now)
    return 'refreshed'
  } catch (error) {
    if (isDiscogsAuthError(error)) return 'auth'
    throw error
  }
}

export async function keepCollectionFresh(
  options: DiscogsClientOptions & { durable?: DurableStore | null; deadlineMs?: number } = {}
): Promise<KeepCollectionResult> {
  const { readCachedCollection } = await import('../discogs.ts')
  const durable =
    options.durable !== undefined ? options.durable : getDefaultRedisDurableStore()
  const now = options.now ?? Date.now
  const deadlineMs = options.deadlineMs ?? workerDeadlineMs(now())

  if (durable) {
    const refresh = await refreshStaleCollection(durable, options, now, deadlineMs)
    if (refresh === 'auth') {
      return { refreshedCollection: false, visitEnrich: skippedAuthQueueResult() }
    }
    if (refresh === 'refreshed') {
      return { refreshedCollection: true, visitEnrich: null }
    }
  }

  const store = getDefaultCrateStore()
  if (!store) return { refreshedCollection: false, visitEnrich: null }

  const collection = await readCachedCollection(options)
  if (collection && now() < deadlineMs) {
    await queueNewAndMissing(store, await store.getSeen(), collection)
  }
  if (now() >= deadlineMs) {
    return { refreshedCollection: false, visitEnrich: null }
  }
  const visitEnrich = await processEnrichmentQueue(
    {
      store,
      collection: collection ?? undefined,
      deadlineMs,
      budgetMs: remainingBudgetMs(deadlineMs, now()),
    },
    1
  )
  return { refreshedCollection: false, visitEnrich }
}

export async function runCrateEnrichCron(options: {
  store: CrateStore
  durable?: DurableStore | null
  now?: () => number
  deadlineMs?: number
  discogs?: DiscogsClientOptions
  fetchDiscogs?: EnrichDeps['fetchDiscogs']
}): Promise<EnrichQueueResult> {
  const { readCachedCollection } = await import('../discogs.ts')
  const now = options.now ?? Date.now
  const deadlineMs = options.deadlineMs ?? workerDeadlineMs(now())
  const durable =
    options.durable !== undefined ? options.durable : getDefaultRedisDurableStore()
  const discogs = options.discogs ?? {}

  if (durable) {
    const refresh = await refreshStaleCollection(durable, discogs, now, deadlineMs)
    if (refresh === 'auth') {
      return skippedAuthQueueResult()
    }
  }

  const collection = await readCachedCollection({ ...discogs, durable })
  if (collection && now() < deadlineMs) {
    await queueNewAndMissing(options.store, await options.store.getSeen(), collection)
  }
  return processEnrichmentQueue({
    store: options.store,
    collection: collection ?? undefined,
    now,
    deadlineMs,
    budgetMs: remainingBudgetMs(deadlineMs, now()),
    lockTtlSeconds: ENRICH_LOCK_SECONDS,
    fetchDiscogs: options.fetchDiscogs,
  })
}
