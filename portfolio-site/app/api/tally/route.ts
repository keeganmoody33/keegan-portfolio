import { NextResponse } from 'next/server'
import {
  readTally,
  TALLY_SNAPSHOT_CACHE_CONTROL,
  TALLY_UNAVAILABLE_CACHE_CONTROL,
} from '@/lib/tally-store'

export const dynamic = 'force-dynamic'

function unavailable() {
  return NextResponse.json(
    { error: 'tally unavailable' },
    {
      status: 503,
      headers: { 'Cache-Control': TALLY_UNAVAILABLE_CACHE_CONTROL },
    }
  )
}

/** Public running totals for the footer tally. Cached at the edge for a minute. */
export async function GET() {
  try {
    const snapshot = await readTally()
    if (!snapshot) {
      return unavailable()
    }
    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': TALLY_SNAPSHOT_CACHE_CONTROL },
    })
  } catch {
    return unavailable()
  }
}
