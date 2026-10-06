import { NextRequest, NextResponse } from 'next/server'
import { cronSecretEqual } from '@/lib/crate/cron-auth'
import { runBackfill } from '@/lib/crate/backfill'
import { getDefaultCrateStore } from '@/lib/crate/store'
import { readCachedCollection } from '@/lib/discogs'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

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
    return NextResponse.json({ skipped: true, reason: 'no store' })
  }

  const collection = await readCachedCollection()
  if (!collection) {
    return NextResponse.json({ skipped: true, reason: 'no collection' })
  }

  try {
    const result = await runBackfill({ store, collection })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { error: 'backfill failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
