import { NextRequest, NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'

interface GitHubEvent {
  type: string
  created_at: string
  repo: {
    name: string
  }
}

export async function GET(request: NextRequest) {
  const posthog = getPostHogClient()
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anonymous_server'

  try {
    posthog.capture({
      distinctId,
      event: 'api_github_request',
      properties: { source: 'api_route' }
    })

    // Fetch recent public events for keeganmoody33
    // GitHub public events API — no auth needed, 60 req/hr unauthenticated
    const response = await fetch(
      'https://api.github.com/users/keeganmoody33/events/public?per_page=100',
      {
        headers: {
          'User-Agent': 'LecturesFromPortfolio/1.0',
          'Accept': 'application/vnd.github+json',
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('GitHub API error:', error)

      posthog.capture({
        distinctId,
        event: 'api_github_error',
        properties: {
          error_type: 'github_api_error',
          error_message: 'Failed to fetch from GitHub',
          status_code: response.status
        }
      })

      return NextResponse.json(
        { error: 'Failed to fetch from GitHub' },
        { status: 502 }
      )
    }

    const events: GitHubEvent[] = await response.json()

    // Calculate stats from events
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Pushes in last 24 hours
    const pushes24h = events.filter(
      (e) => e.type === 'PushEvent' && new Date(e.created_at) > twentyFourHoursAgo
    ).length

    // Pushes in last 7 days
    const pushes7d = events.filter(
      (e) => e.type === 'PushEvent' && new Date(e.created_at) > sevenDaysAgo
    ).length

    // PRs opened (from events, not full PR API)
    const prsOpened = events.filter(
      (e) => e.type === 'PullRequestEvent'
    ).length

    // Most recent event
    const latestEvent = events.length > 0 ? events[0] : null
    const latestRepo = latestEvent?.repo?.name?.split('/')?.pop() || null
    const latestAction = latestEvent?.type?.replace('Event', '') || null
    const latestTime = latestEvent?.created_at || null

    return NextResponse.json({
      pushes_24h: pushes24h,
      pushes_7d: pushes7d,
      prs_recent: prsOpened,
      latest_repo: latestRepo,
      latest_action: latestAction,
      latest_time: latestTime,
      total_events: events.length,
    })

  } catch (error) {
    console.error('GitHub API route error:', error)

    posthog.capture({
      distinctId,
      event: 'api_github_error',
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
