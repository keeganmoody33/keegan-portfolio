import { NextRequest, NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { fetchFullCollection, peekLastGoodCollection } from '@/lib/discogs'

export async function GET(request: NextRequest) {
  const posthog = getPostHogClient()
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anonymous_server'

  const rateLimit = checkRateLimit(request, 'api/discogs/collection', 30, 60 * 1000)
  if (!rateLimit.success) {
    const cached = peekLastGoodCollection()
    posthog.capture({
      distinctId,
      event: 'api_rate_limited',
      properties: {
        route: 'api/discogs/collection',
        ip:
          (request as NextRequest & { ip?: string }).ip ||
          request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
          'unknown',
      },
    })
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Retry-After': String(rateLimit.retryAfter) },
      })
    }
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    )
  }

  try {
    const collection = await fetchFullCollection()
    posthog.capture({
      distinctId,
      event: 'api_discogs_collection_request',
      properties: {
        source: 'api_route',
        items: collection.pagination.items,
      },
    })
    return NextResponse.json(collection)
  } catch (error) {
    const status = (error as Error & { status?: number }).status
    const retryAfter = (error as Error & { retryAfter?: string }).retryAfter
    const cached = peekLastGoodCollection()

    posthog.capture({
      distinctId,
      event: 'api_discogs_error',
      properties: {
        error_type: status === 429 ? 'discogs_rate_limited' : 'internal_error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        route: 'api/discogs/collection',
      },
    })

    if (cached) {
      return NextResponse.json(cached)
    }

    if (status === 429) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': retryAfter ?? '60' } }
      )
    }

    if (error instanceof Error && error.message.includes('DISCOGS_TOKEN')) {
      return NextResponse.json({ error: 'DISCOGS_TOKEN not configured' }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to fetch from Discogs' }, { status: 502 })
  }
}
