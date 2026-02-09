'use client'

import { useState, useEffect } from 'react'
import posthog from 'posthog-js'

interface Release {
  title: string
  artist: string
  year: number
  thumbnail: string
  discogsUrl: string
}

export default function RecentDigs() {
  const [releases, setReleases] = useState<Release[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchDigs() {
      try {
        const response = await fetch('/api/discogs')
        if (!response.ok) throw new Error('Failed to fetch')
        const data = await response.json()
        setReleases(data)
      } catch (err) {
        console.error('RecentDigs fetch error:', err)
        setError(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDigs()
  }, [])

  // Graceful — hide widget on error, don't break page
  if (error) return null

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full border-b border-[var(--border-dim)] bg-[var(--bg-surface)] font-mono">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center gap-4">
            <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider shrink-0">
              Recent Digs
            </p>
            <div className="flex gap-2 overflow-x-auto">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[60px] md:w-[72px]">
                  <div className="aspect-square bg-[var(--bg-body)] border border-[var(--border-dim)] rounded-sm animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (releases.length === 0) return null

  const handleRecordClick = (release: Release) => {
    posthog.capture('recent_digs_record_clicked', {
      title: release.title,
      artist: release.artist,
      discogsUrl: release.discogsUrl,
    })
  }

  return (
    <div className="w-full border-b border-[var(--border-dim)] bg-[var(--bg-surface)] font-mono">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center gap-4">
          <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider shrink-0">
            Recent Digs
          </p>

          {/* Horizontal scroll of compact covers */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide touch-pan-x pb-0.5">
            {releases.map((release) => (
              <a
                key={release.discogsUrl}
                href={release.discogsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleRecordClick(release)}
                className="flex-shrink-0 w-[60px] md:w-[72px] group relative"
                title={`${release.artist} — ${release.title}`}
              >
                {/* Cover art */}
                <div className="aspect-square overflow-hidden rounded-sm border border-[var(--border-dim)] group-hover:border-[var(--accent-lime)] transition-colors">
                  {release.thumbnail ? (
                    <img
                      src={release.thumbnail}
                      alt={`${release.artist} — ${release.title}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-[var(--bg-body)] flex items-center justify-center">
                      <span className="text-[var(--text-muted)] text-xs">🎵</span>
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}