import { NextRequest, NextResponse } from 'next/server'
import { cronSecretEqual } from '@/lib/crate/cron-auth'
import { processEnrichmentQueue } from '@/lib/crate/enrich'
import { getDefaultCrateStore } from '@/lib/crate/store'
import { queueNewAndMissing } from '@/lib/crate/sync'
import { readCachedCollection } from '@/lib/discogs'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return new NextResponse(null, { status: 404 })
  }
  if (!cronSecretEqual(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const store = getDefaultCrateStore()
  if (!store) {
    return NextResponse.json({ processed: [], skipped: true, reason: 'no store' })
  }

  try {
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
