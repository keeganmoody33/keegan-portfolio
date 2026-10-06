import { NextRequest, NextResponse } from 'next/server'
import { cronGate } from '@/lib/crate/cron-auth'
import { keepCollectionFresh } from '@/lib/crate/keep'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = cronGate(request)
  if (denied) return denied

  try {
    const result = await keepCollectionFresh()
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { error: 'keep failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
