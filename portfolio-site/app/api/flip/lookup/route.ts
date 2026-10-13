import { NextRequest, NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  emptyLookup,
  everysongApiKey,
  lookupCacheKey,
  lookupEverysong,
  samplesForSong,
  songLookupCacheKey,
} from '@/lib/flip/everysong.ts'
import { fixtureLookup, parseFlipStub } from '@/lib/flip/fixtures.ts'
import { readFlipLookupCache, writeFlipLookupCache } from '@/lib/flip/store.ts'
import {
  FLIP_LOOKUP_RATE_LIMIT,
  FLIP_QUERY_MAX,
  FLIP_RATE_WINDOW_MS,
} from '@/lib/flip/types.ts'
import { isProductionRedisNamespace } from '@/lib/redis-env.ts'

export const runtime = 'nodejs'

function clientIp(request: NextRequest): string {
  return (
    (request as NextRequest & { ip?: string }).ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

function clip(value: string | null): string {
  return (value ?? '').trim().slice(0, FLIP_QUERY_MAX)
}

export async function GET(request: NextRequest) {
  const posthog = getPostHogClient()
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anonymous_server'
  const ip = clientIp(request)

  const rateLimit = checkRateLimit(request, 'api/flip/lookup', FLIP_LOOKUP_RATE_LIMIT, FLIP_RATE_WINDOW_MS)
  if (!rateLimit.success) {
    posthog.capture({
      distinctId,
      event: 'api_rate_limited',
      properties: { route: 'api/flip/lookup', ip },
    })
    return NextResponse.json(emptyLookup('down'), {
      status: 429,
      headers: { 'Retry-After': String(rateLimit.retryAfter), 'Cache-Control': 'no-store' },
    })
  }

  const url = new URL(request.url)
  const query = clip(url.searchParams.get('q'))
  const title = clip(url.searchParams.get('title'))
  const artist = clip(url.searchParams.get('artist'))
  const stub = parseFlipStub(url.searchParams.get('stub'))
  const production = isProductionRedisNamespace()

  if (stub && !production) {
    posthog.capture({
      distinctId,
      event: 'api_flip_lookup',
      properties: { source: 'fixture', stub, has_query: query.length > 0 },
    })
    return NextResponse.json(fixtureLookup(stub, title, artist), {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const key = everysongApiKey()
  if (!key) {
    posthog.capture({
      distinctId,
      event: 'api_flip_lookup',
      properties: { source: 'missing_key' },
    })
    return NextResponse.json(emptyLookup('down'), {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const picked = title.length > 0 && artist.length > 0
  if (!picked && !query) {
    return NextResponse.json(emptyLookup('no_match'), {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const hash = picked ? songLookupCacheKey(title, artist) : lookupCacheKey(query)
  const cached = await readFlipLookupCache(hash)
  if (cached) {
    posthog.capture({
      distinctId,
      event: 'api_flip_lookup',
      properties: { source: 'cache', status: cached.status },
    })
    return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  }

  const result = picked
    ? await samplesForSong({ rid: null, title, artist, year: null, isrc: null }, { key })
    : await lookupEverysong(query, { key })
  if (result.status === 'ok' || result.status === 'no_match') {
    await writeFlipLookupCache(hash, result)
  }
  posthog.capture({
    distinctId,
    event: 'api_flip_lookup',
    properties: { source: 'everysong', status: result.status },
  })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
