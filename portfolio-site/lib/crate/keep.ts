import {
  DISCOGS_SNAPSHOT_TTL_MS,
  getDefaultRedisDurableStore,
  isSnapshotStale,
  type DurableStore,
} from '../discogs-store.ts'
import type { DiscogsClientOptions } from '../discogs.ts'
import { processEnrichmentQueue, type EnrichQueueResult } from './enrich.ts'
import { getDefaultCrateStore } from './store.ts'
import { queueNewAndMissing } from './sync.ts'

export type KeepCollectionResult = {
  refreshedCollection: boolean
  visitEnrich: EnrichQueueResult | null
}

export async function keepCollectionFresh(
  options: DiscogsClientOptions & { durable?: DurableStore | null } = {}
): Promise<KeepCollectionResult> {
  const { readCachedCollection, refreshDurableCollection } = await import('../discogs.ts')
  const durable =
    options.durable !== undefined ? options.durable : getDefaultRedisDurableStore()
  const now = options.now ?? Date.now
  let refreshedCollection = false

  if (durable) {
    let fetchedAt: number | null = null
    try {
      const snapshot = await durable.get()
      fetchedAt = snapshot?.meta?.fetchedAt ?? null
    } catch {
      fetchedAt = null
    }
    if (isSnapshotStale(fetchedAt, now(), DISCOGS_SNAPSHOT_TTL_MS)) {
      await refreshDurableCollection(durable, options, now)
      refreshedCollection = true
    }
  }

  if (refreshedCollection) {
    return { refreshedCollection, visitEnrich: null }
  }

  const store = getDefaultCrateStore()
  if (!store) return { refreshedCollection, visitEnrich: null }

  const collection = await readCachedCollection(options)
  if (collection) {
    await queueNewAndMissing(store, await store.getSeen(), collection)
  }
  const visitEnrich = await processEnrichmentQueue(
    { store, collection: collection ?? undefined },
    1
  )
  return { refreshedCollection, visitEnrich }
}
