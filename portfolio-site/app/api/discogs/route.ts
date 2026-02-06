import { NextRequest, NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'

export async function GET(request: NextRequest) {
  const posthog = getPostHogClient()

  // Get distinct ID from header if available (passed from client)
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anonymous_server'

  try {
    const discogsToken = process.env.DISCOGS_TOKEN

    if (!discogsToken) {
      posthog.capture({
        distinctId,
        event: 'api_discogs_error',
        properties: {
          error_type: 'configuration_missing',
          error_message: 'DISCOGS_TOKEN not configured'
        }
      })
      return NextResponse.json(
        { error: 'DISCOGS_TOKEN not configured' },
        { status: 500 }
      )
    }

    // Track server-side discogs request
    posthog.capture({
      distinctId,
      event: 'api_discogs_request',
      properties: {
        source: 'api_route'
      }
    })

    // Call Discogs API — fetch 5 most recently added releases
    const response = await fetch(
      'https://api.discogs.com/users/lecturesfrom/collection/folders/0/releases?sort=added&sort_order=desc&per_page=5&page=1',
      {
        headers: {
          'Authorization': `Discogs token=${discogsToken}`,
          'User-Agent': 'LecturesFromPortfolio/1.0',
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Discogs API error:', error)

      posthog.capture({
        distinctId,
        event: 'api_discogs_error',
        properties: {
          error_type: 'discogs_api_error',
          error_message: 'Failed to fetch from Discogs',
          status_code: response.status
        }
      })

      return NextResponse.json(
        { error: 'Failed to fetch from Discogs' },
        { status: 502 }
      )
    }

    const data = await response.json()

    // Transform Discogs response to clean shape
    const releases = (data.releases || []).map(
      (release: { basic_information: { title: string; year: number; thumb: string; artists: { name: string }[]; id: number } }) => ({
        title: release.basic_information.title,
        artist: release.basic_information.artists
          .map((a: { name: string }) => a.name)
          .join(', '),
        year: release.basic_information.year,
        thumbnail: release.basic_information.thumb,
        discogsUrl: `https://www.discogs.com/release/${release.basic_information.id}`,
      })
    )

    return NextResponse.json(releases)

  } catch (error) {
    console.error('Discogs API route error:', error)

    posthog.capture({
      distinctId,
      event: 'api_discogs_error',
      properties: {
        error_type: 'internal_error',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
