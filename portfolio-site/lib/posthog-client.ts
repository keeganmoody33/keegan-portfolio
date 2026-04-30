'use client'

import posthog from 'posthog-js'

const DISTINCT_ID_HEADER = 'X-POSTHOG-DISTINCT-ID'

let initAttempted = false

export { posthog }

export function ensurePostHogInitialized() {
  if (typeof window === 'undefined' || initAttempted) return

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!posthogKey) return

  const client = posthog as typeof posthog & { __loaded?: boolean }
  if (!client.__loaded) {
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      defaults: '2025-11-30',
      capture_exceptions: true,
      debug: process.env.NODE_ENV === 'development',
    })
  }

  initAttempted = true
}

export function getPostHogDistinctIdHeader(): Record<string, string> {
  ensurePostHogInitialized()

  const distinctId = posthog.get_distinct_id()
  if (
    typeof distinctId !== 'string' ||
    distinctId.trim().length === 0 ||
    distinctId === 'undefined'
  ) {
    return {}
  }

  return { [DISTINCT_ID_HEADER]: distinctId }
}
