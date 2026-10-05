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
      // NEXT_PUBLIC_POSTHOG_HOST: https://flow.lecturesfrom.com once the managed proxy is live.
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      ui_host: 'https://us.posthog.com',
      defaults: '2026-05-30',
      capture_exceptions: true,
      // Tag bots as $browser_type=bot instead of dropping them (Humans vs Machines tally).
      opt_out_useragent_filter: true,
      debug: process.env.NODE_ENV === 'development',
    })
    // One shared PostHog project serves every lecturesfrom site; this labels the source.
    posthog.register({ site: 'lecturesfrom' })
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
