import { NextResponse } from 'next/server'
import { aiCatalogJson } from '@/lib/markdown'

export function GET() {
  return NextResponse.json(aiCatalogJson())
}
