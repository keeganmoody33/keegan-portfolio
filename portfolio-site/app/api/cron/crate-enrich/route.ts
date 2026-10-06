import { NextRequest, NextResponse } from 'next/server'
import { cronGate } from '@/lib/crate/cron-auth'
import { processEnrichmentQueue } from '@/lib/crate/enrich'
import { getDefaultCrateStore } from '@/lib/crate/store'
import { queueNewAndMissing } from '@/lib/crate/sync'
import { readCachedCollection, refreshDurableCollection } from '@/lib/discogs'
import {
  DISCOGS_SNAPSHOT_TTL_MS,
  getDefaultRedisDurableStore,
  isSnapshotStale,
} from '@/lib/discogs-store'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = cronGate(request)
  if (denied) return denied

  const store = getDefaultCrateStore()
  if (!store) {
    return NextResponse.json({ processed: [], skipped: true, reason: 'no store' })
  }

  try {
    const durable = getDefaultRedisDurableStore()
    if (durable) {
      let fetchedAt: number | null = null
      try {
        const snapshot = await durable.get()
        fetchedAt = snapshot?.meta?.fetchedAt ?? null
      } catch {
        fetchedAt = null
      }
      if (isSnapshotStale(fetchedAt, Date.now(), DISCOGS_SNAPSHOT_TTL_MS)) {
        await refreshDurableCollection(durable, {}, Date.now)
      }
    }
    const collection = await readCachedCollection()
    if (collection) {
      await queueNewAndMissing(store, await store.getSeen(), collection)
    }
    const result = await processEnrichmentQueue({ store, collection })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'enrichment failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
