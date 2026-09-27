import { NextRequest, NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  discogsErrorHttp,
  fetchFullCollection,
  readCachedCollection,
} from '@/lib/discogs'

export const revalidate = 300

function clientIp(request: NextRequest): string {
  return (
    (request as NextRequest & { ip?: string }).ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  )
}

export async function GET(request: NextRequest) {
  const posthog = getPostHogClient()
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anonymous_server'

  const rateLimit = checkRateLimit(request, 'api/discogs/collection', 30, 60 * 1000)
  if (!rateLimit.success) {
    const cached = await readCachedCollection()
    posthog.capture({
      distinctId,
      event: 'api_rate_limited',
      properties: {
        route: 'api/discogs/collection',
        ip: clientIp(request),
      },
    })
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfter),
          'Cache-Control': 'no-store',
        },
      }
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
    const mapped = discogsErrorHttp(error)

    posthog.capture({
      distinctId,
      event: 'api_discogs_error',
      properties: {
        error_type:
          mapped.status === 429 ? 'discogs_rate_limited' : 'internal_error',
        error_message: mapped.body.error,
        route: 'api/discogs/collection',
        status_code: mapped.status,
      },
    })

    return NextResponse.json(mapped.body, {
      status: mapped.status,
      headers: mapped.headers,
    })
  }
}
