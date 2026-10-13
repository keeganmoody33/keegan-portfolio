'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, useSyncExternalStore } from 'react'
import HouseBannerShader from '@/components/house/HouseBannerShader'
import {
  HOUSE_BANNER_BOOT_LINES,
  HOUSE_BANNER_SEEN_KEY,
  bannerCoverUrl,
  bannerLiveText,
  buildBannerQueue,
  houseBannerGlyphs,
  initialBannerPhase,
  lecturesfromWordmark,
  nextBannerPhase,
  phaseDurationMs,
  pullOneIndex,
  readForceBoot,
  wrapIndex,
  type HouseBannerPhase,
  type HouseBannerRelease,
} from '@/lib/house-banner'
import { posthog } from '@/lib/posthog-client'

const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)]'

const controlClass = `house-text-button min-h-11 sm:min-h-8 ${focusRing}`

type BootSnapshot = {
  reduced: boolean
  seen: boolean
  forceBoot: boolean
}

const SERVER_BOOT_SNAPSHOT: BootSnapshot = {
  reduced: false,
  seen: true,
  forceBoot: false,
}

let cachedBootSnapshot: BootSnapshot | null = null

function sameBootSnapshot(a: BootSnapshot, b: BootSnapshot): boolean {
  return a.reduced === b.reduced && a.seen === b.seen && a.forceBoot === b.forceBoot
}

function readBootSnapshot(): BootSnapshot {
  const next: BootSnapshot = {
    reduced: window.matchMedia(MOTION_QUERY).matches,
    seen: sessionStorage.getItem(HOUSE_BANNER_SEEN_KEY) === '1',
    forceBoot: readForceBoot(window.location.search),
  }
  if (cachedBootSnapshot && sameBootSnapshot(cachedBootSnapshot, next)) {
    return cachedBootSnapshot
  }
  cachedBootSnapshot = next
  return next
}

function subscribeBootSnapshot(onStoreChange: () => void): () => void {
  const media = window.matchMedia(MOTION_QUERY)
  const handler = () => {
    cachedBootSnapshot = null
    onStoreChange()
  }
  media.addEventListener('change', handler)
  window.addEventListener('storage', handler)
  return () => {
    media.removeEventListener('change', handler)
    window.removeEventListener('storage', handler)
  }
}

function BannerCover({ src }: { src: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return <span className="house-banner-cover house-banner-cover-empty" />
  }
  return (
    <Image
      src={src}
      alt=""
      width={64}
      height={64}
      sizes="64px"
      unoptimized
      onError={() => setBroken(true)}
      className="house-banner-cover"
    />
  )
}

export default function HouseBanner({
  releases,
  initialId,
}: {
  releases: HouseBannerRelease[]
  initialId: number | null
}) {
  const snapshot = useSyncExternalStore(
    subscribeBootSnapshot,
    readBootSnapshot,
    () => SERVER_BOOT_SNAPSHOT
  )
  const intent = initialBannerPhase({
    reducedMotion: snapshot.reduced,
    seen: snapshot.seen,
    forceBoot: snapshot.forceBoot,
  })
  const [elapsed, setElapsed] = useState<HouseBannerPhase>('boot')
  const phase: HouseBannerPhase = intent === 'playing' ? 'playing' : elapsed
  const [queue] = useState(() => buildBannerQueue(releases, initialId, () => 0))
  const [index, setIndex] = useState(0)
  const glyphs = houseBannerGlyphs()
  const wordmark = lecturesfromWordmark()
  const current = queue[index] ?? null
  const coverSrc = current ? bannerCoverUrl(current) : ''
  const interactive = queue.length > 0
  const showShader = phase === 'playing' && !snapshot.reduced

  useEffect(() => {
    if (phase === 'playing') {
      sessionStorage.setItem(HOUSE_BANNER_SEEN_KEY, '1')
      return undefined
    }
    const ms = phaseDurationMs(phase)
    if (ms == null) return undefined
    if (phase === 'boot') {
      posthog.capture('house_banner_boot')
    }
    const timer = window.setTimeout(() => {
      setElapsed(nextBannerPhase(phase))
    }, ms)
    return () => window.clearTimeout(timer)
  }, [phase])

  function go(delta: number, event: 'house_banner_prev' | 'house_banner_next'): void {
    if (queue.length === 0) return
    const nextIndex = wrapIndex(index, queue.length, delta)
    setIndex(nextIndex)
    posthog.capture(event, { release_id: queue[nextIndex]?.releaseId ?? 0 })
  }

  function pullOne(): void {
    if (queue.length === 0) return
    const nextIndex = pullOneIndex(index, queue.length)
    setIndex(nextIndex)
    posthog.capture('house_banner_pull_one', {
      release_id: queue[nextIndex]?.releaseId ?? 0,
    })
  }

  return (
    <section
      className="house-banner"
      data-phase={phase}
      aria-label="lecturesfrom banner"
    >
      {showShader ? <HouseBannerShader /> : null}

      <h1 className="sr-only">{wordmark}</h1>

      <div className="house-banner-stage">
        <div className="house-banner-boot" aria-hidden="true">
          {HOUSE_BANNER_BOOT_LINES.map((line) => (
            <p key={line} className="house-banner-boot-line">
              {line}
            </p>
          ))}
        </div>

        <p className="house-banner-wordmark" aria-hidden="true">
          {glyphs.map((glyph, glyphIndex) => (
            <span
              key={`${glyph}-${glyphIndex}`}
              className="house-banner-glyph"
            >
              {glyph}
            </span>
          ))}
        </p>

        <div className="house-banner-readout">
          {current ? (
            <Link
              href={`/collection/${current.releaseId}`}
              prefetch={false}
              className={`house-banner-now group ${focusRing}`}
              onClick={() => {
                posthog.capture('house_banner_open', {
                  release_id: current.releaseId,
                })
              }}
            >
              <BannerCover key={current.releaseId} src={coverSrc} />
              <span className="house-banner-copy">
                <span className="house-banner-artist">{current.artist}</span>
                <span className="house-banner-title">{current.title}</span>
                {current.label ? (
                  <span className="house-banner-label">{current.label}</span>
                ) : null}
              </span>
            </Link>
          ) : (
            <p className="house-banner-empty">crate unavailable</p>
          )}

          <div
            className="house-banner-controls"
            role="group"
            aria-label="now playing"
          >
            <button
              type="button"
              className={controlClass}
              aria-label="previous record"
              disabled={!interactive}
              onClick={() => go(-1, 'house_banner_prev')}
            >
              prev
            </button>
            <button
              type="button"
              className={controlClass}
              aria-label="pull one"
              disabled={!interactive}
              onClick={pullOne}
            >
              play
            </button>
            <button
              type="button"
              className={controlClass}
              aria-label="next record"
              disabled={!interactive}
              onClick={() => go(1, 'house_banner_next')}
            >
              next
            </button>
          </div>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {phase === 'playing' ? bannerLiveText(current) : ''}
      </p>
    </section>
  )
}
