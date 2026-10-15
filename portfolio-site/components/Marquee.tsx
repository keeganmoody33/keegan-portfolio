'use client'

import { useEffect, useState } from 'react'
import { getPostHogDistinctIdHeader } from '@/lib/posthog-client'

interface GitHubStats {
  pushes_24h: number
  pushes_7d: number
  prs_recent: number
  latest_repo: string | null
  latest_action: string | null
}

export default function Marquee() {
  const [github, setGitHub] = useState<GitHubStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchGitHub() {
      try {
        const res = await fetch('/api/github', {
          headers: getPostHogDistinctIdHeader(),
        })
        if (res.ok) {
          const data = await res.json()
          setGitHub(data)
        }
      } catch {
        // Keep the location and work labels if activity is unavailable.
      } finally {
        setLoading(false)
      }
    }
    fetchGitHub()
  }, [])

  const gitText = github
    ? `${github.pushes_7d} pushes this week · ${github.pushes_24h} in the past day`
    : loading ? 'Loading GitHub activity...' : 'GitHub activity unavailable'

  const latestText = github?.latest_repo
    ? `LATEST: ${github.latest_action} on ${github.latest_repo}`
    : 'Explore the projects in the catalog'

  const items = [
    { label: 'GIT', text: gitText },
    { label: 'WORK', text: 'Sales execution + revenue systems' },
    { label: 'FROM', text: 'Atlanta, Georgia' },
    { label: 'LOG', text: latestText },
  ]

  // Duplicate items for seamless loop
  const allItems = [...items, ...items]

  return (
    <div
      role="region"
      aria-label="Activity ticker"
      className="w-full overflow-hidden border-b border-[var(--border-dim)] bg-[var(--bg-surface)]"
    >
      <div className="marquee-container py-2">
        {allItems.map((item, i) => (
          <div key={i} aria-hidden={i >= items.length || undefined} className="flex items-center gap-2 px-8 whitespace-nowrap">
            <span className="text-[var(--accent-lime)] font-mono text-xs font-bold">{item.label}</span>
            <span className="text-[var(--text-muted)] font-mono text-xs">
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
