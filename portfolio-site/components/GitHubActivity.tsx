'use client'

import { useState, useEffect } from 'react'
import posthog from 'posthog-js'

interface DailyActivity {
  date: string
  count: number
}

interface GitHubData {
  pushes_24h: number
  pushes_7d: number
  total_events: number
  daily_activity: DailyActivity[]
}

export default function GitHubActivity() {
  const [data, setData] = useState<GitHubData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchActivity() {
      try {
        const response = await fetch('/api/github')
        if (!response.ok) throw new Error('Failed to fetch')
        const json = await response.json()
        setData(json)
      } catch (err) {
        console.error('GitHubActivity fetch error:', err)
        setError(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchActivity()
  }, [])

  const handleClick = () => {
    posthog.capture('github_activity_clicked', {
      destination_url: 'https://github.com/keeganmoody33',
    })
  }

  // Graceful — hide on error
  if (error) return null

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full border-b border-[var(--border-dim)] bg-[var(--bg-surface)] font-mono">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center gap-4">
            <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider shrink-0">
              GitHub Activity
            </p>
            <div className="flex items-end gap-[2px] h-[24px] flex-1">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-[var(--bg-body)] border border-[var(--border-dim)] rounded-sm animate-pulse"
                  style={{ height: `${Math.random() * 60 + 20}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!data || data.daily_activity.length === 0) return null

  const maxCount = Math.max(...data.daily_activity.map((d) => d.count), 1)

  return (
    <div className="w-full border-b border-[var(--border-dim)] bg-[var(--bg-surface)] font-mono">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center gap-4">
          <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider shrink-0">
            GitHub Activity
          </p>

          {/* Retro bar chart — 14 days */}
          <a
            href="https://github.com/keeganmoody33"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="flex items-end gap-[2px] h-[24px] flex-1 group cursor-pointer"
          >
            {data.daily_activity.map((day) => {
              const heightPercent = maxCount > 0 ? (day.count / maxCount) * 100 : 0
              const isToday = day.date === new Date().toISOString().split('T')[0]
              const hasActivity = day.count > 0

              return (
                <div
                  key={day.date}
                  className="flex-1 relative"
                >
                  <div
                    className={`
                      w-full rounded-sm transition-all duration-200
                      ${hasActivity
                        ? isToday
                          ? 'bg-[var(--accent-lime)] shadow-[0_0_6px_rgba(204,255,0,0.4)]'
                          : 'bg-[var(--accent-lime)] opacity-60 group-hover:opacity-80'
                        : 'bg-[var(--border-dim)] opacity-40'
                      }
                    `}
                    style={{ height: hasActivity ? `${Math.max(heightPercent, 12)}%` : '3px' }}
                  />
                </div>
              )
            })}
          </a>

          <a
            href="https://github.com/keeganmoody33"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="text-[var(--text-muted)] text-[10px] hover:text-[var(--accent-lime)] transition-colors shrink-0"
          >
            {data.pushes_7d} pushes / 7d
          </a>
        </div>
      </div>
    </div>
  )
}
