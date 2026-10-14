import { NextRequest, NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { emptySearch, everysongApiKey, searchCacheKey, searchEverysong } from '@/lib/flip/everysong.ts'
import { fixtureSearch, parseFlipStub } from '@/lib/flip/fixtures.ts'
import { flipProductionLocked, readFlipSearchCache, writeFlipSearchCache } from '@/lib/flip/store.ts'
import {
  FLIP_QUERY_MAX,
  FLIP_RATE_WINDOW_MS,
  FLIP_SEARCH_MIN_CHARS,
  FLIP_SEARCH_RATE_LIMIT,
} from '@/lib/flip/types.ts'

export const runtime = 'nodejs'

function clientIp(request: NextRequest): string {
  return (
    (request as NextRequest & { ip?: string }).ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

export async function GET(request: NextRequest) {
  const posthog = getPostHogClient()
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anonymous_server'
  const ip = clientIp(request)

  const rateLimit = checkRateLimit(request, 'api/flip/search', FLIP_SEARCH_RATE_LIMIT, FLIP_RATE_WINDOW_MS)
  if (!rateLimit.success) {
    posthog.capture({
      distinctId,
      event: 'api_rate_limited',
      properties: { route: 'api/flip/search', ip },
    })
    return NextResponse.json(emptySearch('down'), {
      status: 429,
      headers: { 'Retry-After': String(rateLimit.retryAfter), 'Cache-Control': 'no-store' },
    })
  }

  const url = new URL(request.url)
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, FLIP_QUERY_MAX)
  const stub = parseFlipStub(url.searchParams.get('stub'))
  const production = flipProductionLocked()

  if (stub && !production) {
    posthog.capture({
      distinctId,
      event: 'api_flip_search',
      properties: { source: 'fixture', stub, has_query: query.length > 0 },
    })
    return NextResponse.json(fixtureSearch(stub), {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const key = everysongApiKey()
  if (!key) {
    posthog.capture({
      distinctId,
      event: 'api_flip_search',
      properties: { source: 'missing_key' },
    })
    return NextResponse.json(emptySearch('down'), {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  if (query.length < FLIP_SEARCH_MIN_CHARS) {
    return NextResponse.json(emptySearch('ok'), {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const hash = searchCacheKey(query)
  const cached = await readFlipSearchCache(hash)
  if (cached) {
    posthog.capture({
      distinctId,
      event: 'api_flip_search',
      properties: { source: 'cache', status: cached.status, hits: cached.hits.length },
    })
    return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  }

  const result = await searchEverysong(query, { key })
  if (result.status === 'ok' || result.status === 'no_match') {
    await writeFlipSearchCache(hash, result)
  }
  posthog.capture({
    distinctId,
    event: 'api_flip_search',
    properties: { source: 'everysong', status: result.status, hits: result.hits.length },
  })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
