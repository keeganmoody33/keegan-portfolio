import { NextRequest, NextResponse } from 'next/server'
import { cronGate } from '@/lib/crate/cron-auth'
import { inspectCrate } from '@/lib/crate/backfill'
import { getDefaultCrateStore } from '@/lib/crate/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = cronGate(request)
  if (denied) return denied

  const store = getDefaultCrateStore()
  if (!store) {
    return NextResponse.json({ error: 'no store' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  const snapshot = await inspectCrate(store)
  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
}
