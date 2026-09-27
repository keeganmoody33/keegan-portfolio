import { NextResponse } from 'next/server'
import { discoveryDocument } from '@/lib/markdown'

export function GET() {
  return NextResponse.json(discoveryDocument(), {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
