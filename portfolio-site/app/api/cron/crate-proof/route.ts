import { NextRequest, NextResponse } from 'next/server'
import { cronGate } from '@/lib/crate/cron-auth'
import {
  crateProofAllowed,
  parseProofAction,
  parseProofIds,
  runCrateProof,
} from '@/lib/crate/proof'
import { getDefaultCrateStore } from '@/lib/crate/store'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!crateProofAllowed()) {
    return NextResponse.json(
      { error: 'proof refused in production' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const denied = cronGate(request)
  if (denied) return denied

  const store = getDefaultCrateStore()
  if (!store) {
    return NextResponse.json({ error: 'no store' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  const action = parseProofAction(request.nextUrl.searchParams.get('action'))
  if (!action) {
    return NextResponse.json(
      { error: 'unknown action' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    const result = await runCrateProof(store, action, {
      ids: parseProofIds(request.nextUrl.searchParams.get('ids')),
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { error: 'proof failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
