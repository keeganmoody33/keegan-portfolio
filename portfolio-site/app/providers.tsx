'use client'

import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { ensurePostHogInitialized, posthog } from '@/lib/posthog-client'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    ensurePostHogInitialized()
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
