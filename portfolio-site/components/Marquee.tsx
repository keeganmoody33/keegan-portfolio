'use client'

import { useEffect, useState } from 'react'

interface GitHubStats {
  pushes_24h: number
  pushes_7d: number
  prs_recent: number
  latest_repo: string | null
  latest_action: string | null
}

export default function Marquee() {
  const [github, setGitHub] = useState<GitHubStats | null>(null)

  useEffect(() => {
    async function fetchGitHub() {
      try {
        const res = await fetch('/api/github')
        if (res.ok) {
          const data = await res.json()
          setGitHub(data)
        }
      } catch {
        // Marquee degrades gracefully — static items still show
      }
    }
    fetchGitHub()
  }, [])

  const gitText = github
    ? `GIT_STATUS :: PUSHES_7D: ${github.pushes_7d} // PUSHES_24H: ${github.pushes_24h}`
    : 'GIT_STATUS :: LOADING...'

  const latestText = github?.latest_repo
    ? `LATEST: ${github.latest_action} on ${github.latest_repo}`
    : 'LATEST: ...'

  const items = [
    { label: 'GIT', text: gitText },
    { label: 'SYS', text: 'ANTHROPIC: CLAUDE OPUS ACTIVE' },
    { label: 'NET', text: 'VERCEL: DEPLOYED' },
    { label: 'LOG', text: latestText },
  ]

  // Duplicate items for seamless loop
  const allItems = [...items, ...items]

  return (
    <div className="w-full overflow-hidden border-b border-[var(--border-dim)] bg-[var(--bg-surface)]">
      <div className="marquee-container py-2">
        {allItems.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-8 whitespace-nowrap">
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
