'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { posthog } from '@/lib/posthog-client'
import type { SleeveViewerConfig } from '@/lib/catalog'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { hasWebGL } from '@/lib/webgl'
import {
  CAMERA_PRESET_BUTTONS,
  CONTROL_CANDIDATES,
  PART_READOUT_IDLE,
  SLEEVE_VIEW_MODES,
  YADIGGG_CAD_ENVELOPE,
  YADIGGG_CAD_GEOMETRY,
  YADIGGG_CANDIDATE_B_SRC,
  YADIGGG_LOCKED_FACTS,
  YADIGGG_REFERENCE_SRC,
  isBlockedViewerSrc,
  type CameraPreset,
  type ControlCandidate,
  type PartReadout,
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
  const sectionRef = useRef<HTMLElement | null>(null)
  const [inView, setInView] = useState(false)
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [view, setView] = useState<SleeveViewMode>('assembled')
  const [candidate, setCandidate] = useState<ControlCandidate>('A')
  const [preset, setPreset] = useState<CameraPreset>('reset')
  const [presetTick, setPresetTick] = useState(0)
  const [hover, setHover] = useState<PartReadout | null>(null)
  const [selected, setSelected] = useState<PartReadout | null>(null)
  const [canvasReady, setCanvasReady] = useState(false)
  const [failed, setFailed] = useState(false)

  const blocked = isBlockedViewerSrc(viewer.src)
  const poster = viewer.poster ?? posterSrc
  const readout = hover ?? selected ?? PART_READOUT_IDLE
  const viewLabel = SLEEVE_VIEW_MODES.find((mode) => mode.id === view)?.label ?? view
  const candidateMeta = CONTROL_CANDIDATES.find((entry) => entry.id === candidate)

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
    ? fallbackCaption(fallback, viewer.title)
    : view === 'compare'
      ? 'original concept image. illustration; geometry differs from cad.'
      : `${sleeveTitle} r1 allocation study`

  return (
    <section
      ref={sectionRef}
      className="mt-12 border-t border-[var(--house-line)] pt-6"
      aria-label={viewer.title}
    >
      <div className="house-sleeve-workbench">
        <div className="house-sleeve-stage-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="house-meta">01 / physical study</p>
              <h2 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.01em]">
                Made for the dig.
              </h2>
              <p className="mt-2 max-w-md font-mono text-[12px] leading-relaxed text-[var(--house-muted)]">
                A revised allocation. An interaction to try — restyled in house.
              </p>
            </div>
            <span className="house-sleeve-measure">
              <span className="font-[family-name:var(--house-font-lcd)] text-lg font-extrabold tracking-[0.04em]">
                105 × 60 × 15
              </span>
              <small>mm body · locked</small>
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-1" aria-label="assembly view">
            {SLEEVE_VIEW_MODES.map((mode) => (
              <ModeButton
                key={mode.id}
                selected={view === mode.id}
                label={mode.label}
                onClick={() => {
                  setView(mode.id)
                  posthog.capture('sleeve_viewer_mode', { view: mode.id })
                }}
              />
            ))}
          </div>

          <div
            id={focusRootId}
            tabIndex={0}
            role="img"
            aria-label={`${viewer.title}. drag or arrow keys to orbit, plus and minus to zoom. all device facts also appear in the adjacent panel.`}
            className={`house-sleeve-stage relative mt-0 overflow-hidden bg-[var(--house-bg)] ${focusRing}`}
          >
            <Poster src={poster} title={viewer.title} caption={caption} />
            {showStudy && viewer.mode === 'port' ? (
              <div
                className={`absolute inset-0 ${canvasReady && view !== 'compare' ? 'opacity-100' : 'opacity-0'}`}
              >
                <YadigggStudy
                  src={viewer.src}
                  candidateSrc={YADIGGG_CANDIDATE_B_SRC}
                  view={view}
                  candidate={candidate}
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
                className="absolute inset-0 h-full w-full border-0 bg-[var(--house-bg)]"
                onLoad={onReady}
              />
            ) : null}
            {view === 'compare' ? (
              <figure className="absolute inset-0 z-[2] m-0 bg-[var(--house-bg)] text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={YADIGGG_REFERENCE_SRC}
                  alt="Original repository concept: smoke-clear portrait YADIGGG with orange side control"
                  className="h-[90%] w-full object-contain"
                />
                <figcaption className="px-3 font-mono text-[11px] text-[var(--house-muted)]">
                  Original concept image. Illustration; geometry differs from CAD.
                </figcaption>
              </figure>
            ) : null}
            {showStudy && viewer.mode === 'port' && !canvasReady && view !== 'compare' ? (
              <p className="pointer-events-none absolute inset-x-0 top-[45%] text-center font-mono text-[11px] text-[var(--house-muted)]">
                Loading the model…
              </p>
            ) : null}
          </div>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--house-dim)]">{caption}</p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
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
            <p className="house-meta hidden sm:block">drag to orbit · scroll to zoom</p>
          </div>

          <p
            className="house-sleeve-readout"
            aria-live="polite"
          >
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
              Dimensioned study, not manufacturing CAD. Electronics are simplified volumes; hardware,
              tolerances and assembly remain unvalidated. R1 CAD envelope {YADIGGG_CAD_ENVELOPE}.
              Locked product stays 105 × 60 × 15 mm, one orange side button, 2.7&quot; memory LCD,
              USB-C, 3.5 mm.
            </p>
          </div>
        </div>

        <aside className="house-sleeve-rail">
          <p className="house-meta">02 / allocation</p>
          <h3 className="mt-2 font-display text-[1.45rem] font-semibold leading-[1.15] tracking-[-0.01em]">
            Locked product.
          </h3>
          <p className="mt-3 font-mono text-[12px] leading-relaxed text-[var(--house-muted)]">
            Hover or click the model. The LCD reads parts and facts — not a capture demo. Candidate B
            is the same reserved opening, different control layout.
          </p>

          <p className="house-meta mt-6 mb-2" id={`${focusRootId}-candidate`}>
            control candidate
          </p>
          <div className="flex flex-wrap gap-1" role="group" aria-labelledby={`${focusRootId}-candidate`}>
            {CONTROL_CANDIDATES.map((entry) => (
              <ModeButton
                key={entry.id}
                selected={candidate === entry.id}
                label={entry.label}
                onClick={() => {
                  setCandidate(entry.id)
                  posthog.capture('sleeve_viewer_candidate', { candidate: entry.id })
                }}
              />
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-[var(--house-dim)]">
            {candidateMeta?.hint}
          </p>

          <div className="house-sleeve-lcd" aria-label="Device facts readout" aria-live="polite">
            <div className="house-sleeve-lcd-top">
              <span>YADIGGG / R1</span>
              <span>{viewLabel}</span>
            </div>
            <h4>{readout.label}</h4>
            <p>{readout.note}</p>
            <ol>
              {YADIGGG_LOCKED_FACTS.map((fact, index) => (
                <li key={fact.label} className={index === 0 ? 'selected' : undefined}>
                  {fact.value} · {fact.label}
                </li>
              ))}
              <li>
                CAD {YADIGGG_CAD_ENVELOPE} · allocation study
              </li>
            </ol>
          </div>

          <details className="house-sleeve-modeled">
            <summary className={`${focusRing} cursor-pointer`}>What is modeled?</summary>
            <p>
              Hollow front and rear shells, display envelope, PCB allocation with control notch,
              battery, camera and connector reservations. X-ray shows cable and RF allowances. Open
              front removes the front shell and window for inspection.
            </p>
            <p>
              Camera optics, battery protection, fasteners, sealing, strain relief, PCB routing and
              thermal paths need engineering. Candidate B is a control layout comparison on the same
              reserved opening.
            </p>
          </details>
        </aside>
      </div>
    </section>
  )
}
