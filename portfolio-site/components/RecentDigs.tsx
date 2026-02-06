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
      <div className="max-w-7xl mx-auto px-4 py-4">
        <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">
          Recent Digs
        </p>
          {/* Desktop: horizontal row skeleton */}
          <div className="hidden md:flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-1 min-w-0">
                <div className="aspect-square bg-[var(--bg-body)] border border-[var(--border-dim)] rounded animate-pulse" />
                <div className="mt-2 h-3 bg-[var(--bg-body)] rounded w-3/4 animate-pulse" />
                <div className="mt-1 h-3 bg-[var(--bg-body)] rounded w-1/2 animate-pulse" />
              </div>
            ))}
          </div>
          {/* Mobile: horizontal scroll skeleton */}
          <div className="flex md:hidden gap-3 overflow-x-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[140px]">
                <div className="aspect-square bg-[var(--bg-body)] border border-[var(--border-dim)] rounded animate-pulse" />
                <div className="mt-2 h-3 bg-[var(--bg-body)] rounded w-3/4 animate-pulse" />
                <div className="mt-1 h-3 bg-[var(--bg-body)] rounded w-1/2 animate-pulse" />
              </div>
            ))}
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
      <div className="max-w-7xl mx-auto px-4 py-4">
        <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">
          Recent Digs
        </p>

        {/* Desktop: horizontal row of 5 records */}
        <div className="hidden md:flex gap-4">
          {releases.map((release) => (
            <a
              key={release.discogsUrl}
              href={release.discogsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleRecordClick(release)}
              className="flex-1 min-w-0 group"
            >
              {/* Cover art */}
              <div className="aspect-square overflow-hidden rounded border border-[var(--border-dim)] group-hover:border-[var(--accent-lime)] transition-colors">
                {release.thumbnail ? (
                  <img
                    src={release.thumbnail}
                    alt={`${release.artist} — ${release.title}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--bg-body)] flex items-center justify-center">
                    <span className="text-[var(--text-muted)] text-2xl">🎵</span>
                  </div>
                )}
              </div>
              {/* Metadata */}
              <p className="mt-2 text-[var(--text-bright)] text-xs leading-tight truncate group-hover:text-[var(--accent-lime)] transition-colors">
                {release.title}
              </p>
              <p className="text-[var(--text-muted)] text-xs leading-tight truncate">
                {release.artist}
              </p>
            </a>
          ))}
        </div>

        {/* Mobile: horizontal scroll with snap points */}
        <div className="flex md:hidden gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide touch-pan-x">
          {releases.map((release) => (
            <a
              key={release.discogsUrl}
              href={release.discogsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleRecordClick(release)}
              className="flex-shrink-0 w-[140px] snap-start group"
            >
              {/* Cover art */}
              <div className="aspect-square overflow-hidden rounded border border-[var(--border-dim)] group-hover:border-[var(--accent-lime)] transition-colors">
                {release.thumbnail ? (
                  <img
                    src={release.thumbnail}
                    alt={`${release.artist} — ${release.title}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--bg-body)] flex items-center justify-center">
                    <span className="text-[var(--text-muted)] text-2xl">🎵</span>
                  </div>
                )}
              </div>
              {/* Metadata */}
              <p className="mt-2 text-[var(--text-bright)] text-xs leading-tight truncate group-hover:text-[var(--accent-lime)] transition-colors">
                {release.title}
              </p>
              <p className="text-[var(--text-muted)] text-xs leading-tight truncate">
                {release.artist}
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
