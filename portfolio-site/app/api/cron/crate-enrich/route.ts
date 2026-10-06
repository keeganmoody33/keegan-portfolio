import { NextRequest, NextResponse } from 'next/server'
import { processEnrichmentQueue } from '@/lib/crate/enrich'
import { getDefaultCrateStore } from '@/lib/crate/store'
import { queueNewAndMissing } from '@/lib/crate/sync'
import { readCachedCollection } from '@/lib/discogs'

export const runtime = 'nodejs'
export const maxDuration = 60

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return new NextResponse(null, { status: 404 })
  }
  if (!cronAuthorized(request)) {
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
    const result = await processEnrichmentQueue({ store }, 2)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'enrichment failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
