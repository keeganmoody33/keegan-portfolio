'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { posthog } from '@/lib/posthog-client'
import type { SleeveViewerConfig } from '@/lib/catalog'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { hasWebGL } from '@/lib/webgl'
import {
  CAMERA_PRESET_BUTTONS,
  PART_READOUT_DEFAULT,
  SLEEVE_VIEW_MODES,
  YADIGGG_LOCKED_FACTS,
  isBlockedViewerSrc,
  type CameraPreset,
  type SleeveViewMode,
} from '@/lib/yadiggg-viewer'

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)]'

const YadigggStudy = dynamic(() => import('./YadigggViewer'), { ssr: false, loading: () => null })

type SleeveViewerProps = {
  viewer: SleeveViewerConfig
  posterSrc: string
  sleeveTitle: string
}

type FallbackReason = 'reduced-motion' | 'no-webgl' | 'blocked' | 'error'

function fallbackCaption(reason: FallbackReason, title: string): string {
  switch (reason) {
    case 'reduced-motion':
      return `${title} static study — 3d orbit paused for reduced motion.`
    case 'no-webgl':
      return `${title} static study — webgl is not available on this device.`
    case 'blocked':
      return `${title} static study — preview urls are not embedded.`
    case 'error':
      return `${title} static study — the 3d study could not load.`
    default: {
      const _never: never = reason
      return _never
    }
  }
}

function Poster({ src, title, caption }: { src: string; title: string; caption: string }) {
  return (
    <figure className="absolute inset-0 m-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-contain object-center" />
      <figcaption className="sr-only">{caption || `${title} study image`}</figcaption>
    </figure>
  )
}

export default function SleeveViewer({ viewer, posterSrc, sleeveTitle }: SleeveViewerProps) {
  const reducedMotion = useReducedMotion()
  const focusRootId = useId().replace(/:/g, '')
  const sectionRef = useRef<HTMLElement | null>(null)
  const [inView, setInView] = useState(false)
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [view, setView] = useState<SleeveViewMode>('assembled')
  const [preset, setPreset] = useState<CameraPreset>('reset')
  const [presetTick, setPresetTick] = useState(0)
  const [readout, setReadout] = useState(PART_READOUT_DEFAULT)
  const [canvasReady, setCanvasReady] = useState(false)
  const [failed, setFailed] = useState(false)

  const blocked = isBlockedViewerSrc(viewer.src)
  const poster = viewer.poster ?? posterSrc

  useEffect(() => {
    const node = sectionRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setInView(true)
        setWebgl(hasWebGL(document.createElement('canvas')))
      },
      { rootMargin: '120px', threshold: 0.1 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const fallback: FallbackReason | null = blocked
    ? 'blocked'
    : reducedMotion
      ? 'reduced-motion'
      : webgl === false
        ? 'no-webgl'
        : failed
          ? 'error'
          : null

  const canPort =
    viewer.mode === 'port' && !blocked && !failed && !reducedMotion && webgl === true && inView
  const canFrame = viewer.mode === 'iframe' && !blocked && !failed && !reducedMotion && inView
  const showStudy = canPort || canFrame

  const onReady = useCallback(() => {
    setCanvasReady(true)
    posthog.capture('sleeve_viewer_loaded', { title: viewer.title, mode: viewer.mode })
  }, [viewer.mode, viewer.title])

  const onError = useCallback(() => {
    setFailed(true)
  }, [])

  const onPart = useCallback((label: string, note: string) => {
    setReadout(`${label} · ${note}`)
    posthog.capture('sleeve_viewer_part', { part: label })
  }, [])

  const caption = fallback
    ? fallbackCaption(fallback, viewer.title)
    : `${sleeveTitle} r1 allocation study`

  return (
    <section
      ref={sectionRef}
      className="mt-12 border-t border-[var(--house-line)] pt-6"
      aria-label={viewer.title}
    >
      <h2 className="house-meta mb-4">{viewer.title}</h2>

      <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--house-line)]" aria-label="assembly view">
        {SLEEVE_VIEW_MODES.map((mode) => {
          const selected = view === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              aria-pressed={selected}
              className={`house-meta -mb-px min-h-11 border-b pb-2 sm:min-h-6 ${focusRing} ${
                selected
                  ? 'border-[var(--house-ink)] text-[var(--house-ink)]'
                  : 'border-transparent text-[var(--house-muted)] hover:text-[var(--house-orange)]'
              }`}
              onClick={() => {
                setView(mode.id)
                posthog.capture('sleeve_viewer_mode', { view: mode.id })
              }}
            >
              {mode.label}
            </button>
          )
        })}
      </div>

      <div
        id={focusRootId}
        tabIndex={0}
        role="img"
        aria-label={`${viewer.title}. drag or arrow keys to orbit, plus and minus to zoom.`}
        className={`house-sleeve-stage relative mt-4 overflow-hidden border border-[var(--house-line)] bg-[var(--house-bg)] ${focusRing}`}
      >
        <Poster src={poster} title={viewer.title} caption={caption} />
        {showStudy && viewer.mode === 'port' ? (
          <div className={`absolute inset-0 ${canvasReady ? 'opacity-100' : 'opacity-0'}`}>
            <YadigggStudy
              src={viewer.src}
              view={view}
              preset={preset}
              presetTick={presetTick}
              reducedMotion={reducedMotion}
              focusRootId={focusRootId}
              onPart={onPart}
              onReady={onReady}
              onError={onError}
            />
          </div>
        ) : null}
        {showStudy && viewer.mode === 'iframe' ? (
          <iframe
            src={viewer.src}
            title={viewer.title}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full border-0 bg-[var(--house-bg)]"
            onLoad={onReady}
          />
        ) : null}
      </div>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--house-dim)]">{caption}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4" aria-label="camera direction">
          {CAMERA_PRESET_BUTTONS.map((button) => (
            <button
              key={button.id}
              type="button"
              className={`house-text-button min-h-11 sm:min-h-6 ${focusRing} ${
                preset === button.id ? 'text-[var(--house-ink)]' : ''
              }`}
              aria-pressed={preset === button.id}
              onClick={() => {
                setPreset(button.id)
                setPresetTick((tick) => tick + 1)
                posthog.capture('sleeve_viewer_preset', { preset: button.id })
              }}
            >
              {button.label}
            </button>
          ))}
        </div>
        <p className="house-meta">drag to orbit · scroll to zoom</p>
      </div>

      <p
        className="mt-4 min-h-[2.5rem] border-t border-[var(--house-line)] pt-3 font-mono text-[11px] leading-relaxed text-[var(--house-muted)]"
        aria-live="polite"
      >
        {readout}
      </p>

      <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-[var(--house-line)] pt-5 sm:grid-cols-3">
        {YADIGGG_LOCKED_FACTS.map((fact) => (
          <div key={fact.label}>
            <dt className="font-[family-name:var(--house-font-lcd)] text-lg font-extrabold tracking-[0.04em] text-[var(--house-ink)]">
              {fact.value}
            </dt>
            <dd className="mt-1 font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--house-muted)]">
              {fact.label}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 max-w-xl font-mono text-[11px] leading-relaxed text-[var(--house-dim)]">
        r1 allocation study. electronics are simplified volumes. locked product: one orange side button, 2.7&quot;
        memory lcd, 105 × 60 × 15 mm smoke-clear shell, usb-c, 3.5 mm jack.
      </p>
    </section>
  )
}
