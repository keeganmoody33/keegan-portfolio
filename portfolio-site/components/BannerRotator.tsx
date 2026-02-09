'use client'

import { Children, useState, useEffect, type ReactNode } from 'react'
import posthog from 'posthog-js'

interface BannerRotatorProps {
  children: ReactNode
  /** Labels shown as tooltips on the indicator dots */
  labels?: string[]
  /** Rotation interval in ms (default 8000) */
  intervalMs?: number
}

/**
 * Rotating banner — mounts all panels simultaneously (critical for
 * YouTubePlayer whose iframe must stay alive) but displays only the
 * active one. Crossfade transition, auto-rotates, pauses on hover.
 */
export default function BannerRotator({
  children,
  labels = [],
  intervalMs = 8000,
}: BannerRotatorProps) {
  const panels = Children.toArray(children)
  const count = panels.length

  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  // Auto-rotate
  useEffect(() => {
    if (paused || count <= 1) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % count)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [paused, count, intervalMs])

  // Track panel switches
  const goTo = (index: number) => {
    if (index === activeIndex) return
    posthog.capture('banner_panel_switched', {
      from: labels[activeIndex] || `panel_${activeIndex}`,
      to: labels[index] || `panel_${index}`,
      method: 'click',
    })
    setActiveIndex(index)
  }

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* All panels rendered; only active one is visible */}
      {panels.map((child, i) => (
        <div
          key={i}
          className={`
            transition-opacity duration-500 ease-in-out
            ${i === activeIndex
              ? 'relative opacity-100 z-10'
              : 'absolute top-0 left-0 right-0 opacity-0 z-0 pointer-events-none'
            }
          `}
        >
          {child}
        </div>
      ))}

      {/* Indicator dots — right edge, vertically centered */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1">
        {panels.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="p-1.5 -m-0.5"
            aria-label={labels[i] || `Banner ${i + 1}`}
            title={labels[i] || undefined}
          >
            <span
              className={`
                block w-1.5 h-1.5 rounded-full transition-all duration-200
                ${i === activeIndex
                  ? 'bg-[var(--accent-lime)]'
                  : 'bg-[var(--border-dim)] hover:bg-[var(--text-muted)]'
                }
              `}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
