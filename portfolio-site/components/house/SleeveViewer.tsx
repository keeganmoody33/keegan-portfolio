'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { posthog } from '@/lib/posthog-client'
import type { SleeveViewerConfig } from '@/lib/catalog'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { hasWebGL } from '@/lib/webgl'
import {
  CAMERA_PRESET_BUTTONS,
  PART_READOUT_FALLBACK,
  PART_READOUT_IDLE,
  SLEEVE_VIEW_MODES,
  YADIGGG_CAD_ENVELOPE,
  YADIGGG_CAD_GEOMETRY,
  YADIGGG_GESTURE_HINT,
  YADIGGG_GESTURE_HINT_TOUCH,
  YADIGGG_LOCKED_FACTS,
  YADIGGG_MODEL_ENVELOPE,
  YADIGGG_POSTER_PORTRAIT_SRC,
  YADIGGG_POSTER_SRC,
  YADIGGG_RAIL_FALLBACK,
  YADIGGG_RAIL_LIVE,
  YADIGGG_REFERENCE_SRC,
  isBlockedViewerSrc,
  shouldReserveViewerChrome,
  shouldShowViewerChrome,
  type CameraPreset,
  type PartReadout,
  type SleeveViewMode,
  type ViewerFallbackReason,
} from '@/lib/yadiggg-viewer'

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)]'

const YadigggStudy = dynamic(() => import('./YadigggViewer'), { ssr: false, loading: () => null })

type SleeveViewerProps = {
  viewer: SleeveViewerConfig
  posterSrc: string
  sleeveTitle: string
}

function fallbackCaption(reason: ViewerFallbackReason): string {
  switch (reason) {
    case 'no-webgl':
      return 'webgl is not available on this device.'
    case 'blocked':
      return 'preview urls are not embedded.'
    case 'error':
      return 'the 3d study could not load.'
    default: {
      const _never: never = reason
      return _never
    }
  }
}

function Poster({
  src,
  portraitSrc,
  title,
  hidden,
}: {
  src: string
  portraitSrc: string
  title: string
  hidden: boolean
}) {
  return (
    <figure className={`absolute inset-0 z-0 m-0 ${hidden ? 'opacity-0' : 'opacity-100'}`}>
      <picture>
        <source media="(max-width: 639px)" srcSet={portraitSrc} />
        <img src={src} alt="" className="h-full w-full object-cover object-center" />
      </picture>
      <figcaption className="sr-only">{title} study poster</figcaption>
    </figure>
  )
}

function ModeButton({
  selected,
  label,
  onClick,
}: {
  selected: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`house-meta min-h-11 px-3 py-1.5 sm:min-h-8 ${focusRing} ${
        selected
          ? 'bg-[var(--house-ink)] text-[var(--house-bg)]'
          : 'text-[var(--house-muted)] hover:text-[var(--house-orange)]'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export default function SleeveViewer({ viewer, posterSrc, sleeveTitle }: SleeveViewerProps) {
  const reducedMotion = useReducedMotion()
  const focusRootId = useId().replace(/:/g, '')
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [view, setView] = useState<SleeveViewMode>('assembled')
  const [preset, setPreset] = useState<CameraPreset>('reset')
  const [presetTick, setPresetTick] = useState(0)
  const [hover, setHover] = useState<PartReadout | null>(null)
  const [selected, setSelected] = useState<PartReadout | null>(null)
  const [canvasReady, setCanvasReady] = useState(false)
  const [failed, setFailed] = useState(false)

  const blocked = isBlockedViewerSrc(viewer.src)
  const poster = viewer.poster ?? posterSrc ?? YADIGGG_POSTER_SRC
  const viewLabel = SLEEVE_VIEW_MODES.find((mode) => mode.id === view)?.label ?? view

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

  const fallback: ViewerFallbackReason | null = blocked
    ? 'blocked'
    : webgl === false
      ? 'no-webgl'
      : failed
        ? 'error'
        : null

  const canPort = viewer.mode === 'port' && !blocked && !failed && webgl === true && inView
  const canFrame = viewer.mode === 'iframe' && !blocked && !failed && inView
  const showStudy = canPort || canFrame
  const showChrome = shouldShowViewerChrome(fallback, webgl, viewer.mode)
  const reserveChrome = shouldReserveViewerChrome(fallback, webgl, viewer.mode)
  const readout = fallback ? PART_READOUT_FALLBACK : (hover ?? selected ?? PART_READOUT_IDLE)
  const railCopy = fallback ? YADIGGG_RAIL_FALLBACK : YADIGGG_RAIL_LIVE

  const onReady = useCallback(() => {
    setCanvasReady(true)
    posthog.capture('sleeve_viewer_loaded', { title: viewer.title, mode: viewer.mode })
  }, [viewer.mode, viewer.title])

  const onError = useCallback(() => {
    setFailed(true)
  }, [])

  const onPart = useCallback((label: string, note: string, source: 'hover' | 'select') => {
    if (source === 'hover') {
      setHover({ label, note })
      return
    }
    setSelected({ label, note })
    setHover(null)
    posthog.capture('sleeve_viewer_part', { part: label })
  }, [])

  const onPartLeave = useCallback(() => {
    setHover(null)
  }, [])

  const caption = fallback
    ? fallbackCaption(fallback)
    : view === 'compare'
      ? 'original concept image. illustration; geometry differs from cad.'
      : `${sleeveTitle} r1 allocation study`

  return (
    <div ref={sectionRef} className="mt-0">
      <div className="house-sleeve-workbench">
        <section className="house-sleeve-stage-col" aria-labelledby="yadiggg-study-heading">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="house-meta">01 / physical study</p>
              {/* Not h2: this study is before H1 yadiggg (Keegan: study first). */}
              <p
                id="yadiggg-study-heading"
                className="mt-2 font-display text-[clamp(1.6rem,3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.01em]"
              >
                made for the dig.
              </p>
              <p className="mt-2 max-w-md font-mono text-[12px] leading-relaxed text-[var(--house-muted)]">
                a revised allocation. an interaction to try.
              </p>
            </div>
            <span className="house-sleeve-measure">
              <span className="font-[family-name:var(--house-font-lcd)] text-lg font-extrabold tracking-[0.04em]">
                105 × 60 × 15
              </span>
              <small>mm locked product</small>
            </span>
          </div>

          <div
            className={`house-sleeve-stage-stack${reserveChrome ? '' : ' house-sleeve-stage-stack-fallback'}`}
          >
            {reserveChrome ? (
              <div className="house-sleeve-modes-pad">
                <div
                  className="house-sleeve-modes flex flex-wrap gap-1"
                  aria-hidden={!showChrome}
                  aria-label={showChrome ? 'assembly view' : undefined}
                >
                  {showChrome
                    ? SLEEVE_VIEW_MODES.map((mode) => (
                        <ModeButton
                          key={mode.id}
                          selected={view === mode.id}
                          label={mode.label}
                          onClick={() => {
                            setView(mode.id)
                            posthog.capture('sleeve_viewer_mode', { view: mode.id })
                          }}
                        />
                      ))
                    : null}
                </div>
              </div>
            ) : null}

            <div
              id={focusRootId}
              tabIndex={showChrome ? 0 : undefined}
              role="img"
              aria-label={
                showChrome
                  ? `${viewer.title}. drag to orbit on a pointer. two-finger orbit and pinch to zoom on touch. wheel zooms while focused or with control or command. arrow keys orbit, plus and minus zoom. all device facts also appear in the adjacent panel.`
                  : `${viewer.title}. static poster.`
              }
              className="house-sleeve-stage relative mt-0 overflow-hidden"
            >
              <span className="house-sleeve-focus-ring" aria-hidden="true" />
              <Poster
                src={poster}
                portraitSrc={YADIGGG_POSTER_PORTRAIT_SRC}
                title={viewer.title}
                hidden={Boolean(showStudy && canvasReady && view !== 'compare')}
              />
              {showStudy && viewer.mode === 'port' ? (
                <div
                  className={`house-sleeve-live-slot motion-reduce:transition-none motion-reduce:duration-0 ${
                    canvasReady && view !== 'compare' ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ transition: reducedMotion ? undefined : 'opacity 150ms linear' }}
                >
                  <YadigggStudy
                    src={viewer.src}
                    view={view}
                    preset={preset}
                    presetTick={presetTick}
                    reducedMotion={reducedMotion}
                    focusRootId={focusRootId}
                    onPart={onPart}
                    onPartLeave={onPartLeave}
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
                  className="house-sleeve-live-slot h-full w-full border-0 bg-[var(--house-stage-paper)]"
                  onLoad={onReady}
                />
              ) : null}
              {showChrome && view === 'compare' ? (
                <figure className="house-sleeve-live-slot m-0 bg-[var(--house-stage-paper)] text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={YADIGGG_REFERENCE_SRC}
                    alt="Original repository concept: smoke-clear portrait YADIGGG with orange side control"
                    className="h-full w-full object-contain"
                  />
                </figure>
              ) : null}
              {showStudy && viewer.mode === 'port' && !canvasReady && view !== 'compare' ? (
                <p className="house-sleeve-live-slot pointer-events-none z-[3] flex items-center justify-center font-mono text-[11px] text-[var(--house-stage-ink)]">
                  loading the model…
                </p>
              ) : null}
            </div>

            {reserveChrome ? (
              <div className="house-sleeve-presets-pad">
                <div className="house-sleeve-presets flex flex-wrap items-center justify-between gap-3">
                  {showChrome ? (
                    <>
                      <div className="flex flex-wrap gap-1" aria-label="camera direction">
                        {CAMERA_PRESET_BUTTONS.map((button) => (
                          <button
                            key={button.id}
                            type="button"
                            className={`house-meta min-h-11 px-2.5 py-1 sm:min-h-7 ${focusRing} ${
                              preset === button.id
                                ? 'bg-[var(--house-ink)] text-[var(--house-bg)]'
                                : 'text-[var(--house-muted)] hover:text-[var(--house-orange)]'
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
                      <p className="house-meta hidden sm:block">{YADIGGG_GESTURE_HINT}</p>
                      <p className="house-meta sm:hidden">{YADIGGG_GESTURE_HINT_TOUCH}</p>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--house-dim)]">{caption}</p>

          <p className="house-sleeve-readout" aria-live="polite">
            {readout.label} · {readout.note}
          </p>

          <div className="house-sleeve-geometry">
            {YADIGGG_CAD_GEOMETRY.map((fact) => (
              <div key={fact.label}>
                <b>{fact.value}</b>
                <span>{fact.label}</span>
              </div>
            ))}
            <p>
              dimensioned study, not manufacturing cad. electronics are simplified volumes; hardware,
              tolerances and assembly remain unvalidated. locked product is 105 × 60 × 15 mm. the r1
              model envelope is {YADIGGG_CAD_ENVELOPE} — allocation study, not the locked body.
            </p>
          </div>
        </section>

        <section className="house-sleeve-rail" aria-labelledby="yadiggg-rail-heading">
          <p className="house-meta">02 / allocation</p>
          {/* Not h3: rail copy is still before H1 yadiggg. */}
          <p
            id="yadiggg-rail-heading"
            className="mt-2 font-display text-[1.45rem] font-semibold leading-[1.15] tracking-[-0.01em]"
          >
            locked product.
          </p>
          <p className="mt-3 font-mono text-[12px] leading-relaxed text-[var(--house-muted)]">{railCopy}</p>

          <div className="house-sleeve-lcd mt-6" aria-label="Device facts readout" aria-live="polite">
            <div className="house-sleeve-lcd-top">
              <span>YADIGGG / R1</span>
              <span>{viewLabel}</span>
            </div>
            <p className="house-sleeve-lcd-title">{readout.label}</p>
            <p>{readout.note}</p>
            <ol>
              {YADIGGG_LOCKED_FACTS.map((fact, index) => (
                <li key={fact.label} className={index === 0 ? 'selected' : undefined}>
                  {fact.value} · {fact.label}
                </li>
              ))}
              <li>
                {YADIGGG_MODEL_ENVELOPE.value} · {YADIGGG_MODEL_ENVELOPE.label}
              </li>
            </ol>
          </div>

          <details className="house-sleeve-modeled">
            <summary className={`${focusRing} cursor-pointer`}>what is modeled?</summary>
            <p>
              hollow front and rear shells, display envelope, pcb allocation with control notch,
              battery, camera and connector reservations. x-ray shows cable and rf allowances. open
              front removes the front shell and window for inspection. reference shows the original
              concept image.
            </p>
            <p>
              camera optics, battery protection, fasteners, sealing, strain relief, pcb routing and
              thermal paths need engineering.
            </p>
          </details>
        </section>
      </div>
    </div>
  )
}
