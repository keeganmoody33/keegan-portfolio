import { NextRequest, NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  DISCOGS_RECENT_PER_PAGE,
  discogsErrorHttp,
  fetchRecentReleases,
} from '@/lib/discogs'

export const revalidate = 300

export async function GET(request: NextRequest) {
  const posthog = getPostHogClient()
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anonymous_server'

  const rateLimit = checkRateLimit(request, 'api/discogs', 30, 60 * 1000)
  if (!rateLimit.success) {
    posthog.capture({
      distinctId,
      event: 'api_rate_limited',
      properties: {
        route: 'api/discogs',
        ip:
          (request as NextRequest & { ip?: string }).ip ||
          request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
          'unknown',
      },
    })
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
    posthog.capture({
      distinctId,
      event: 'api_discogs_request',
      properties: {
        source: 'api_route',
      },
    })

    const releases = await fetchRecentReleases(DISCOGS_RECENT_PER_PAGE)
    return NextResponse.json(releases)
  } catch (error) {
    const mapped = discogsErrorHttp(error)

    posthog.capture({
      distinctId,
      event: 'api_discogs_error',
      properties: {
        error_type:
          mapped.status === 429 ? 'discogs_rate_limited' : 'discogs_api_error',
        error_message: mapped.body.error,
        status_code: mapped.status,
      },
    })

    return NextResponse.json(mapped.body, {
      status: mapped.status,
      headers: mapped.headers,
    })
  }
}
