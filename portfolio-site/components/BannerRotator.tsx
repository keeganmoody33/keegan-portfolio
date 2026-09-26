'use client'

import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import posthog from 'posthog-js'
import { flushNowPlayingFocusHandoff } from '@/lib/youtube-playback-errors'

export const BannerAvailabilityContext = createContext<
  (available: boolean) => void
>(() => undefined)

const BannerChromeContext = createContext({ showDots: false })

/** Widgets call this so a null/error render drops their slide and dot. */
export function useBannerAvailability(available: boolean) {
  const report = useContext(BannerAvailabilityContext)
  useEffect(() => {
    report(available)
    return () => {
      report(false)
    }
  }, [available, report])
}

/** Inner content pad: `pr-16` only when dots are visible so the bar stays full-bleed. */
export function useBannerPanelPad() {
  const { showDots } = useContext(BannerChromeContext)
  return showDots
    ? 'max-w-7xl mx-auto py-2 pl-4 pr-16'
    : 'max-w-7xl mx-auto px-4 py-2'
}

function BannerSlot({
  index,
  onAvailability,
  children,
}: {
  index: number
  onAvailability: (index: number, available: boolean) => void
  children: ReactNode
}) {
  const report = useCallback(
    (available: boolean) => {
      onAvailability(index, available)
    },
    [index, onAvailability]
  )

  return (
    <BannerAvailabilityContext.Provider value={report}>
      {children}
    </BannerAvailabilityContext.Provider>
  )
}

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
 * Failed or empty panels are dropped from rotation and from the dots.
 */
export default function BannerRotator({
  children,
  labels = [],
  intervalMs = 8000,
}: BannerRotatorProps) {
  const panels = Children.toArray(children)
  const count = panels.length

  const [available, setAvailable] = useState<boolean[]>(() =>
    Array.from({ length: count }, () => true)
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    setAvailable((prev) => {
      if (prev.length === count) return prev
      return Array.from({ length: count }, (_, i) => prev[i] ?? true)
    })
  }, [count])

  const onAvailability = useCallback((index: number, isAvailable: boolean) => {
    setAvailable((prev) => {
      const current = prev[index]
      if (current === isAvailable) return prev
      const next = prev.slice()
      next[index] = isAvailable
      return next
    })
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  const visibleIndices = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => index).filter(
        (index) => available[index] !== false
      ),
    [available, count]
  )

  const firstVisible = visibleIndices[0]
  const resolvedActiveIndex =
    firstVisible !== undefined && !visibleIndices.includes(activeIndex)
      ? firstVisible
      : activeIndex

  useEffect(() => {
    if (firstVisible === undefined) return
    if (resolvedActiveIndex !== activeIndex) {
      setActiveIndex(firstVisible)
    }
  }, [visibleIndices, activeIndex, firstVisible, resolvedActiveIndex])

  useEffect(() => {
    flushNowPlayingFocusHandoff()
  }, [visibleIndices])

  useEffect(() => {
    if (paused || reduceMotion || visibleIndices.length <= 1) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const position = visibleIndices.indexOf(prev)
        const nextPosition =
          position === -1 ? 0 : (position + 1) % visibleIndices.length
        return visibleIndices[nextPosition] ?? prev
      })
    }, intervalMs)
    return () => clearInterval(timer)
  }, [paused, reduceMotion, visibleIndices, intervalMs])

  if (visibleIndices.length === 0) {
    return null
  }

  const showDots = visibleIndices.length > 1

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
    <BannerChromeContext.Provider value={{ showDots }}>
      <div
        className="relative w-full"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {panels.map((child, i) => {
          const isAvailable = available[i] !== false
          const isActive = i === resolvedActiveIndex
          const suppress = !isAvailable || !isActive

          return (
            <BannerSlot key={i} index={i} onAvailability={onAvailability}>
              <div
                data-banner-panel=""
                className={
                  !isAvailable
                    ? 'hidden'
                    : `
                      min-h-12
                      transition-opacity duration-500 ease-in-out
                      ${isActive
                        ? 'relative opacity-100 z-10'
                        : 'absolute top-0 left-0 right-0 opacity-0 z-0 pointer-events-none'
                      }
                    `
                }
                aria-hidden={suppress || undefined}
                {...(suppress ? { inert: true } : {})}
              >
                {child}
              </div>
            </BannerSlot>
          )
        })}

        {showDots && (
          <div
            data-banner-dots=""
            className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1"
          >
            {visibleIndices.map((i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="relative flex h-6 w-6 shrink-0 items-center justify-center"
                aria-label={labels[i] ? `Switch to ${labels[i]}` : `Switch to banner ${i + 1}`}
                title={labels[i] || undefined}
              >
                <span
                  className={`
                    pointer-events-none block h-1.5 w-1.5 rounded-full transition-all duration-200
                    ${i === activeIndex
                      ? 'bg-[var(--accent-lime)]'
                      : 'bg-[var(--border-dim)] hover:bg-[var(--text-muted)]'
                    }
                  `}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </BannerChromeContext.Provider>
  )
}
