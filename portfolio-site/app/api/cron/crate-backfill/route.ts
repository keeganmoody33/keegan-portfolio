import { NextRequest, NextResponse } from 'next/server'
import { cronGate } from '@/lib/crate/cron-auth'
import { runBackfill } from '@/lib/crate/backfill'
import { getDefaultCrateStore } from '@/lib/crate/store'
import { readCachedCollection } from '@/lib/discogs'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = cronGate(request)
  if (denied) return denied

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
