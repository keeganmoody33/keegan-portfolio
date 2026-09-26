'use client'

/**
 * SIGNAL CUT — house <-> person page transition.
 *
 * Overlay is driven by a module-level controller that appends one fixed
 * node to document.body. That is intentional: the triggering Link unmounts
 * on the route swap, so React state / layout.tsx cannot own the overlay.
 *
 * Teardown is a single idempotent function. Copilot 4111027402: never remove
 * the overlay without cancelling snow, every timer/rAF, and html transform.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import {
  type AnchorHTMLAttributes,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
  useEffect,
} from 'react'

export type SignalCutDirection = 'toPerson' | 'toHouse'

export type SignalCutProps = {
  href: string
  direction: SignalCutDirection
  className?: string
  children?: ReactNode
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>

type CutVariant = 'first' | 'repeat' | 'reduced'

type CutRequest = {
  href: string
  direction: SignalCutDirection
  navigate: () => void
}

const STORAGE_KEY = 'lf-signal-cut-count'
const OVERLAY_ID = 'lf-signal-cut-overlay'
const STYLE_ID = 'lf-signal-cut-style'
const Z_INDEX = '2147483647'
const HARD_CAP_MS = 1500
const HARD_CAP_BUFFER_MS = 80
const NOISE_FRAME_COUNT = 6
const PRINT_ORANGE = '#E23D00'

const TEAR_EASE = 'cubic-bezier(0.7, 0, 0.84, 0)'
const REVEAL_EASE = 'cubic-bezier(0.2, 0, 0, 1)'

const FIRST = { tear: 60, snow: 280, push: 280, reveal: 360, end: 420, fade: 60 } as const
const REPEAT = { tear: 40, snow: 40, push: 40, reveal: 120, end: 160, fade: 40 } as const
const REDUCED = { tear: 0, snow: 0, push: 0, reveal: 80, end: 80, fade: 0 } as const

const STYLE_TEXT = `
#${OVERLAY_ID}{
  position:fixed;inset:0;z-index:${Z_INDEX};pointer-events:none;
  contain:strict;opacity:1;background:transparent;overflow:hidden;
}
#${OVERLAY_ID} .lf-sc-layer{position:absolute;inset:0;visibility:hidden}
#${OVERLAY_ID} .lf-sc-canvas{
  width:100%;height:100%;display:block;
  image-rendering:pixelated;image-rendering:crisp-edges;
}
#${OVERLAY_ID} .lf-sc-scan{
  background:repeating-linear-gradient(
    to bottom,
    rgba(255,255,255,0.06) 0px,
    rgba(255,255,255,0.06) 1px,
    transparent 1px,
    transparent 3px
  );
}
#${OVERLAY_ID} .lf-sc-black{background:#000}
#${OVERLAY_ID} .lf-sc-id{
  display:flex;align-items:center;justify-content:center;
  font-family:'Roboto Mono',ui-monospace,monospace;
  font-size:11px;letter-spacing:0.2em;line-height:1;
  color:#d9d9d9;text-transform:lowercase;white-space:pre;
}
#${OVERLAY_ID} .lf-sc-arrow{color:${PRINT_ORANGE}}
#${OVERLAY_ID} .lf-sc-sweep{
  inset:auto;left:0;right:0;top:0;height:2px;
  background:#fff;box-shadow:0 0 6px #fff;
  transform:translateY(0);
  animation-name:lf-sc-sweep;
  animation-timing-function:${TEAR_EASE};
  animation-fill-mode:both;
}
#${OVERLAY_ID}[data-variant="first"] .lf-sc-sweep{animation-duration:60ms}
#${OVERLAY_ID}[data-variant="repeat"] .lf-sc-sweep{animation-duration:40ms}
#${OVERLAY_ID}[data-phase="tear"] .lf-sc-sweep{visibility:visible}
#${OVERLAY_ID}[data-phase="snow"] .lf-sc-canvas,
#${OVERLAY_ID}[data-phase="snow"] .lf-sc-scan{visibility:visible}
#${OVERLAY_ID}[data-phase="black"] .lf-sc-black,
#${OVERLAY_ID}[data-phase="black"] .lf-sc-id{visibility:visible}
#${OVERLAY_ID}[data-phase="black"][data-variant="reduced"] .lf-sc-id{visibility:hidden}
#${OVERLAY_ID}[data-phase="hold"] .lf-sc-black,
#${OVERLAY_ID}[data-phase="hold"] .lf-sc-id{visibility:visible}
#${OVERLAY_ID}[data-phase="hold"][data-variant="reduced"] .lf-sc-id{visibility:hidden}
#${OVERLAY_ID}[data-phase="reveal"] .lf-sc-black,
#${OVERLAY_ID}[data-phase="reveal"] .lf-sc-id{visibility:visible}
#${OVERLAY_ID}[data-phase="reveal"][data-variant="reduced"] .lf-sc-id{visibility:hidden}
@keyframes lf-sc-tear{
  0%{transform:translateY(0)}
  33.333%{transform:translateY(-6vh)}
  66.666%{transform:translateY(2vh)}
  100%{transform:translateY(0)}
}
@keyframes lf-sc-sweep{
  0%{transform:translateY(0)}
  100%{transform:translateY(100vh)}
}
html.lf-sc-tearing{
  animation-name:lf-sc-tear;
  animation-timing-function:${TEAR_EASE};
  animation-fill-mode:both;
  will-change:transform;
}
html.lf-sc-tearing-first{animation-duration:60ms}
html.lf-sc-tearing-repeat{animation-duration:40ms}
`

export type SignalCutDebugState = {
  playing: boolean
  generation: number
  overlayConnected: boolean
  snowing: boolean
  clockRaf: number
  waitRaf: number
  timerCount: number
  htmlTearing: boolean
  htmlTransform: string
}

type Runtime = {
  playing: boolean
  tearingDown: boolean
  generation: number
  timers: number[]
  clockRaf: number
  waitRaf: number
  overlay: HTMLDivElement | null
  canvas: HTMLCanvasElement | null
  noiseFrames: HTMLCanvasElement[] | null
  noiseSize: { w: number; h: number } | null
  snowIndex: number
  snowing: boolean
  pushed: boolean
  tearReverted: boolean
  listenersBound: boolean
  callbackTicks: number
}

const runtime: Runtime = {
  playing: false,
  tearingDown: false,
  generation: 0,
  timers: [],
  clockRaf: 0,
  waitRaf: 0,
  overlay: null,
  canvas: null,
  noiseFrames: null,
  noiseSize: null,
  snowIndex: 0,
  snowing: false,
  pushed: false,
  tearReverted: false,
  listenersBound: false,
  callbackTicks: 0,
}

declare global {
  interface Window {
    __lfSignalCut?: {
      teardown: () => void
      getState: () => SignalCutDebugState
      readonly callbackTicks: number
    }
  }
}

function timingsFor(variant: CutVariant) {
  switch (variant) {
    case 'first':
      return FIRST
    case 'repeat':
      return REPEAT
    case 'reduced':
      return REDUCED
    default: {
      const _exhaustive: never = variant
      return _exhaustive
    }
  }
}

function mark(name: string) {
  try {
    performance.mark(`signalcut:${name}`)
  } catch {
    // performance.mark can throw if the name is reserved
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function readCount(): number {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw == null || raw === '') return 0
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

function incrementCount() {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(readCount() + 1))
  } catch {
    // private mode / blocked storage
  }
}

function pathnameOf(href: string): string {
  try {
    const url = new URL(href, window.location.origin)
    const path = url.pathname.replace(/\/+$/, '')
    return path === '' ? '/' : path
  } catch {
    const path = href.split('?')[0]?.split('#')[0] ?? href
    const trimmed = path.replace(/\/+$/, '')
    return trimmed === '' ? '/' : trimmed
  }
}

function currentPathname(): string {
  const path = window.location.pathname.replace(/\/+$/, '')
  return path === '' ? '/' : path
}

function hrefForRouter(href: string): string {
  try {
    const url = new URL(href, window.location.origin)
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    // fall through
  }
  return href
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE_TEXT
  document.head.appendChild(style)
}

function idLine(direction: SignalCutDirection): { from: string; to: string } {
  return direction === 'toPerson'
    ? { from: 'lf-01', to: 'km-33' }
    : { from: 'km-33', to: 'lf-01' }
}

function ensureOverlay(direction: SignalCutDirection, variant: CutVariant): HTMLDivElement {
  const existing = document.getElementById(OVERLAY_ID)
  if (existing instanceof HTMLDivElement) {
    existing.dataset.variant = variant
    existing.dataset.phase = variant === 'reduced' ? 'black' : 'tear'
    runtime.overlay = existing
    runtime.canvas = existing.querySelector('canvas')
    return existing
  }

  const overlay = document.createElement('div')
  overlay.id = OVERLAY_ID
  overlay.setAttribute('aria-hidden', 'true')
  overlay.dataset.variant = variant
  overlay.dataset.phase = variant === 'reduced' ? 'black' : 'tear'

  const canvas = document.createElement('canvas')
  canvas.className = 'lf-sc-layer lf-sc-canvas'
  canvas.setAttribute('aria-hidden', 'true')

  const scan = document.createElement('div')
  scan.className = 'lf-sc-layer lf-sc-scan'

  const black = document.createElement('div')
  black.className = 'lf-sc-layer lf-sc-black'

  const id = document.createElement('div')
  id.className = 'lf-sc-layer lf-sc-id'
  const labels = idLine(direction)
  const from = document.createElement('span')
  from.textContent = labels.from
  const gapL = document.createTextNode('  ')
  const arrow = document.createElement('span')
  arrow.className = 'lf-sc-arrow'
  arrow.textContent = '→'
  const gapR = document.createTextNode('  ')
  const to = document.createElement('span')
  to.textContent = labels.to
  id.append(from, gapL, arrow, gapR, to)

  const sweep = document.createElement('div')
  sweep.className = 'lf-sc-layer lf-sc-sweep'

  overlay.append(canvas, scan, black, id, sweep)
  document.body.appendChild(overlay)

  runtime.overlay = overlay
  runtime.canvas = canvas
  return overlay
}

function prepareNoise(canvas: HTMLCanvasElement): HTMLCanvasElement[] {
  const w = Math.max(1, Math.ceil(window.innerWidth / 4))
  const h = Math.max(1, Math.ceil(window.innerHeight / 4))
  canvas.width = w
  canvas.height = h

  if (
    runtime.noiseFrames &&
    runtime.noiseSize &&
    runtime.noiseSize.w === w &&
    runtime.noiseSize.h === h
  ) {
    return runtime.noiseFrames
  }

  const frames: HTMLCanvasElement[] = []
  for (let i = 0; i < NOISE_FRAME_COUNT; i++) {
    const frame = document.createElement('canvas')
    frame.width = w
    frame.height = h
    const ctx = frame.getContext('2d', { alpha: false })
    if (!ctx) continue
    const image = ctx.createImageData(w, h)
    const data = image.data
    for (let p = 0; p < data.length; p += 4) {
      const v = (Math.random() * 256) | 0
      data[p] = v
      data[p + 1] = v
      data[p + 2] = v
      data[p + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
    frames.push(frame)
  }

  runtime.noiseFrames = frames
  runtime.noiseSize = { w, h }
  return frames
}

function attachNoise(canvas: HTMLCanvasElement): HTMLCanvasElement[] {
  return prepareNoise(canvas)
}

function warmNoise() {
  if (typeof document === 'undefined') return
  ensureStyle()
  const probe = document.createElement('canvas')
  prepareNoise(probe)
}

function drawSnowFrame() {
  // Never paint a detached canvas (Copilot 4111027402: background-tab snow after overlay.remove).
  if (!runtime.snowing) return
  const canvas = runtime.canvas
  if (!canvas || !canvas.isConnected) return
  const frames = runtime.noiseFrames
  if (!frames || frames.length === 0) return
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return
  const frame = frames[runtime.snowIndex % frames.length]
  if (frame) ctx.drawImage(frame, 0, 0)
  runtime.snowIndex += 1
}

function stopClock() {
  if (runtime.clockRaf !== 0) {
    window.cancelAnimationFrame(runtime.clockRaf)
    runtime.clockRaf = 0
  }
  runtime.snowing = false
}

function revertTear() {
  const root = document.documentElement
  root.classList.remove('lf-sc-tearing', 'lf-sc-tearing-first', 'lf-sc-tearing-repeat')
  root.style.removeProperty('transform')
  root.style.removeProperty('will-change')
  runtime.tearReverted = true
}

function clearTimers() {
  for (const id of runtime.timers) window.clearTimeout(id)
  runtime.timers = []
  if (runtime.waitRaf !== 0) {
    window.cancelAnimationFrame(runtime.waitRaf)
    runtime.waitRaf = 0
  }
  stopClock()
}

function removeOverlay() {
  const overlay = runtime.overlay ?? document.getElementById(OVERLAY_ID)
  if (overlay?.parentNode) overlay.parentNode.removeChild(overlay)
  // Belt: if removeChild missed a stale node, drop it too.
  const leftover = document.getElementById(OVERLAY_ID)
  leftover?.parentNode?.removeChild(leftover)
  runtime.overlay = null
  runtime.canvas = null
}

/**
 * Single idempotent teardown. Every abort and completion path calls this:
 * completion, hard-cap/fallback, slow-destination hold, popstate, pagehide,
 * visibilitychange (hidden), thrown error, second click (no new loop),
 * and mid-crossing page unload. Do not call from the triggering Link's
 * React unmount — that unmount IS the route swap and the overlay must survive.
 */
function teardown() {
  runtime.playing = false
  runtime.snowing = false
  if (runtime.tearingDown) {
    clearTimers()
    revertTear()
    removeOverlay()
    return
  }
  runtime.tearingDown = true
  runtime.generation += 1
  try {
    clearTimers()
    revertTear()
    removeOverlay()
    runtime.pushed = false
  } finally {
    runtime.tearingDown = false
  }
}

function debugState(): SignalCutDebugState {
  const overlay = runtime.overlay ?? document.getElementById(OVERLAY_ID)
  const root = document.documentElement
  return {
    playing: runtime.playing,
    generation: runtime.generation,
    overlayConnected: Boolean(overlay?.isConnected),
    snowing: runtime.snowing,
    clockRaf: runtime.clockRaf,
    waitRaf: runtime.waitRaf,
    timerCount: runtime.timers.length,
    htmlTearing: root.classList.contains('lf-sc-tearing'),
    htmlTransform: root.style.transform,
  }
}

function installDebugHook() {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV !== 'production') {
    window.__lfSignalCut = {
      teardown,
      getState: debugState,
      get callbackTicks() {
        return runtime.callbackTicks
      },
    }
  }
}

function abortIfHidden() {
  if (runtime.playing || runtime.overlay || document.getElementById(OVERLAY_ID)) {
    teardown()
  }
}

function bindGlobalGuards() {
  if (runtime.listenersBound || typeof window === 'undefined') return
  runtime.listenersBound = true
  window.addEventListener('popstate', abortIfHidden)
  window.addEventListener('pagehide', abortIfHidden)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' || document.hidden) abortIfHidden()
  })
}

if (typeof window !== 'undefined') {
  bindGlobalGuards()
  installDebugHook()
}

function waitForPathname(href: string, deadline: number, gen: number): Promise<{
  timedOut: boolean
  heldMs: number
}> {
  const target = pathnameOf(href)
  const started = performance.now()
  if (currentPathname() === target) {
    return Promise.resolve({ timedOut: false, heldMs: 0 })
  }

  return new Promise((resolve) => {
    const tick = () => {
      if (runtime.generation !== gen) {
        resolve({ timedOut: false, heldMs: performance.now() - started })
        return
      }
      runtime.callbackTicks += 1
      const now = performance.now()
      if (currentPathname() === target) {
        resolve({ timedOut: false, heldMs: now - started })
        return
      }
      if (now >= deadline) {
        resolve({ timedOut: true, heldMs: now - started })
        return
      }
      runtime.waitRaf = window.requestAnimationFrame(tick)
    }
    runtime.waitRaf = window.requestAnimationFrame(tick)
  })
}

function fallbackNavigate(req: CutRequest) {
  const alreadyPushed = runtime.pushed
  try {
    teardown()
  } catch {
    runtime.playing = false
    runtime.snowing = false
    try {
      revertTear()
      clearTimers()
      removeOverlay()
    } catch {
      // last-resort cleanup
    }
  }
  if (alreadyPushed) return
  try {
    req.navigate()
  } catch {
    window.location.assign(req.href)
  }
}

function pushNow(req: CutRequest) {
  if (runtime.pushed) return
  runtime.pushed = true
  try {
    req.navigate()
  } catch {
    window.location.assign(req.href)
  }
}

function startTear(variant: CutVariant) {
  const root = document.documentElement
  runtime.tearReverted = false
  root.classList.add(
    'lf-sc-tearing',
    variant === 'first' ? 'lf-sc-tearing-first' : 'lf-sc-tearing-repeat',
  )
}

function playCut(req: CutRequest): boolean {
  if (typeof document === 'undefined' || !document.body) return false
  bindGlobalGuards()
  installDebugHook()
  // Second click during a crossing: swallow, do not start another loop.
  // The in-flight cut already owns timers/rAF; its teardown path will clear them.
  if (runtime.playing) return true

  runtime.playing = true
  runtime.tearingDown = false
  runtime.generation += 1
  const gen = runtime.generation
  runtime.pushed = false
  runtime.tearReverted = false
  runtime.snowIndex = 0
  runtime.snowing = false
  runtime.callbackTicks = 0
  clearTimers()

  const reduced = prefersReducedMotion()
  const prior = readCount()
  incrementCount()
  const variant: CutVariant = reduced ? 'reduced' : prior < 1 ? 'first' : 'repeat'
  const timing = timingsFor(variant)
  const t0 = performance.now()

  mark('start')
  ensureStyle()
  const overlay = ensureOverlay(req.direction, variant)

  const finishReveal = () => {
    if (runtime.generation !== gen) return
    mark('reveal-start')
    overlay.dataset.phase = 'reveal'
    if (timing.fade <= 0) {
      finish()
      return
    }
    overlay.style.transition = `opacity ${timing.fade}ms ${REVEAL_EASE}`
    void overlay.offsetWidth
    overlay.style.opacity = '0'
  }

  let ended = false
  let holding = false
  const finish = () => {
    if (ended || runtime.generation !== gen) return
    ended = true
    runtime.callbackTicks += 1
    mark('end')
    teardown()
  }

  const schedule = (offset: number, fn: () => void) => {
    const delay = Math.max(0, t0 + offset - performance.now())
    const id = window.setTimeout(() => {
      if (runtime.generation !== gen) return
      runtime.callbackTicks += 1
      fn()
    }, delay)
    runtime.timers.push(id)
  }

  const armReveal = () => {
    if (runtime.generation !== gen) return
    if (currentPathname() === pathnameOf(req.href)) {
      finishReveal()
      return
    }
    holding = true
    overlay.dataset.phase = variant === 'reduced' ? 'black' : 'hold'
    void waitForPathname(req.href, t0 + HARD_CAP_MS, gen)
      .then((result) => {
        if (runtime.generation !== gen) return
        if (result.heldMs > 0) {
          try {
            console.info('signalcut:hold', {
              heldMs: Math.round(result.heldMs),
              timedOut: result.timedOut,
              href: req.href,
            })
          } catch {
            // ignore
          }
        }
        finishReveal()
        // After a hold, fade is duration-from-now, not an offset from t0.
        if (timing.fade > 0) {
          const id = window.setTimeout(() => {
            if (runtime.generation !== gen) return
            runtime.callbackTicks += 1
            finish()
          }, timing.fade)
          runtime.timers.push(id)
        } else {
          finish()
        }
      })
      .catch((error: unknown) => {
        if (runtime.generation !== gen) return
        console.error('SignalCut hold failed; tearing down', error)
        fallbackNavigate(req)
      })
  }

  const startSnowLoop = () => {
    runtime.snowing = true
    const paint = () => {
      if (runtime.generation !== gen || !runtime.snowing) return
      runtime.callbackTicks += 1
      drawSnowFrame()
      runtime.clockRaf = window.requestAnimationFrame(paint)
    }
    runtime.clockRaf = window.requestAnimationFrame(paint)
  }

  try {
    if (variant === 'reduced') {
      overlay.dataset.phase = 'black'
      mark('black-end')
      pushNow(req)
    } else {
      startTear(variant)
      const canvasEl = overlay.querySelector('canvas')
      if (variant === 'first' && canvasEl instanceof HTMLCanvasElement) {
        attachNoise(canvasEl)
      }
      schedule(timing.tear, () => {
        revertTear()
        mark('tear-end')
        if (variant === 'first') {
          overlay.dataset.phase = 'snow'
          startSnowLoop()
        } else {
          overlay.dataset.phase = 'black'
          mark('black-end')
          pushNow(req)
        }
      })
      if (variant === 'first') {
        schedule(timing.snow, () => {
          runtime.snowing = false
          stopClock()
          mark('snow-end')
          overlay.dataset.phase = 'black'
          mark('black-end')
          // Person-page hydration during snow starves the 280ms deadline.
          // Overlay has been opaque since snow start, so push here is still covered.
          pushNow(req)
        })
      }
    }

    schedule(timing.reveal, armReveal)
    if (timing.fade > 0) {
      schedule(timing.end, () => {
        if (holding) return
        finish()
      })
    }

    // Hard-cap fallback: setTimeout still fires when rAF is paused in a background
    // tab. Must call teardown (not overlay.remove) so snow cannot paint a detached canvas.
    schedule(HARD_CAP_MS + timing.fade + HARD_CAP_BUFFER_MS, () => {
      fallbackNavigate(req)
    })

    return true
  } catch (error) {
    console.error('SignalCut failed; navigating without overlay', error)
    fallbackNavigate(req)
    return false
  }
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey
  )
}

export default function SignalCut({
  href,
  direction,
  className,
  children,
  onClick,
  onMouseEnter,
  onFocus,
  onTouchStart,
  target,
  ...rest
}: SignalCutProps) {
  const router = useRouter()

  const prefetch = () => {
    try {
      router.prefetch(hrefForRouter(href))
    } catch {
      // prefetch is best-effort
    }
    try {
      warmNoise()
    } catch {
      // noise warmup is best-effort
    }
  }

  useEffect(() => {
    prefetch()
    // Warm destination + noise so the click path does not parse the bundle during snow.
    // Do NOT teardown on this effect's cleanup: the triggering Link unmounts on the
    // route swap and the overlay must outlive that unmount. Pagehide / visibility /
    // popstate / hard-cap / completion own teardown instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href])

  const startFromGesture = (): boolean => {
    if (runtime.playing) return true
    try {
      try {
        posthog.capture('signal_cut_started', { direction, href })
      } catch {
        // analytics must never block navigation
      }
      const started = playCut({
        href,
        direction,
        navigate: () => {
          router.push(hrefForRouter(href))
        },
      })
      queueMicrotask(() => prefetch())
      return started
    } catch (error) {
      console.error('SignalCut gesture failed', error)
      teardown()
      return false
    }
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (target === '_blank') return
    if (isModifiedClick(event)) return
    if (startFromGesture()) event.preventDefault()
  }

  const handleMouseEnter = (event: MouseEvent<HTMLAnchorElement>) => {
    prefetch()
    onMouseEnter?.(event)
  }

  const handleFocus = (event: FocusEvent<HTMLAnchorElement>) => {
    prefetch()
    onFocus?.(event)
  }

  const handleTouchStart = (event: TouchEvent<HTMLAnchorElement>) => {
    prefetch()
    onTouchStart?.(event)
  }

  const handleNavigate = (event: { preventDefault: () => void }) => {
    if (target === '_blank') return
    if (runtime.playing) {
      event.preventDefault()
      return
    }
    if (startFromGesture()) event.preventDefault()
  }

  return (
    <Link
      href={href}
      className={className}
      target={target}
      prefetch={true}
      {...rest}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      onTouchStart={handleTouchStart}
      onNavigate={handleNavigate}
    >
      {children}
    </Link>
  )
}
