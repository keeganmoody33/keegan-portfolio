import { NextRequest, NextResponse } from 'next/server'
import { cronGate } from '@/lib/crate/cron-auth'
import { parseIdList, runBackfill } from '@/lib/crate/backfill'
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

  const retry = request.nextUrl.searchParams.get('retry') === '1'
  const ids = parseIdList(request.nextUrl.searchParams.get('ids'))
  const limitRaw = request.nextUrl.searchParams.get('limit')
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : NaN
  const limit = Number.isInteger(limitParsed) && limitParsed > 0 ? limitParsed : undefined

  try {
    const result = await runBackfill(
      { store, collection, forceRefresh: Boolean(retry) },
      { retry, ids: ids.length > 0 ? ids : undefined, limit }
    )
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { error: 'backfill failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
