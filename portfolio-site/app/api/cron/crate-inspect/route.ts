import { NextRequest, NextResponse } from 'next/server'
import { cronSecretEqual } from '@/lib/crate/cron-auth'
import { inspectCrate } from '@/lib/crate/backfill'
import { getDefaultCrateStore } from '@/lib/crate/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function gate(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return new NextResponse(null, { status: 404 })
  }
  if (!cronSecretEqual(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request: NextRequest) {
  const denied = gate(request)
  if (denied) return denied

  const store = getDefaultCrateStore()
  if (!store) {
    return NextResponse.json({ error: 'no store' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  const snapshot = await inspectCrate(store)
  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
}
