import { NextRequest, NextResponse } from 'next/server'
import { cronGate } from '@/lib/crate/cron-auth'
import { runCrateEnrichCron } from '@/lib/crate/keep'
import { getDefaultCrateStore } from '@/lib/crate/store'
import { workerDeadlineMs } from '@/lib/crate/enrich'

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
    const result = await runCrateEnrichCron({
      store,
      deadlineMs: workerDeadlineMs(),
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'enrichment failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
