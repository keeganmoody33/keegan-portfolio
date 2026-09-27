'use client'

import { useCallback, useLayoutEffect, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'lf-logo-paused'
const CHANGE_EVENT = 'lf-logo-paused'

const ARIA_BOOTSTRAP = `try{if(sessionStorage.getItem('lf-logo-paused')==='1'){var s=document.currentScript;var b=s&&s.previousElementSibling;if(b){b.setAttribute('aria-checked','false');b.setAttribute('aria-label','motion: off');}}}catch(e){}`

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  return () => window.removeEventListener(CHANGE_EVENT, onStoreChange)
}

function getSnapshot(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function getServerSnapshot(): boolean {
  return false
}

function applyHtmlPaused(paused: boolean): void {
  if (paused) {
    document.documentElement.setAttribute('data-logo-paused', 'true')
    return
  }
  document.documentElement.removeAttribute('data-logo-paused')
}

/**
 * WCAG 2.2.2 pause control for the title-card coin spin.
 * Lives in the shared house footer (not next to the decorative mark).
 * Both labels are in the SSR markup; CSS on `html[data-logo-paused]`
 * picks the visible word before paint so a reload with motion off does
 * not flash "motion: on". Grid-stacked spans reserve the wider "off"
 * width. A parser-blocking sibling script (and the head observer) set
 * `aria-checked="false"` before first paint when sessionStorage is
 * paused. `getServerSnapshot` stays playing so hydration matches the
 * default markup; `suppressHydrationWarning` covers the pre-paint
 * aria write. Pause is CSS-only via `html[data-logo-paused="true"]`
 * — never inline `animation-play-state`, never `running`.
 */
export default function MotionSwitch() {
  const paused = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const motionOn = !paused

  useLayoutEffect(() => {
    applyHtmlPaused(getSnapshot())
  }, [paused])

  const onToggle = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, getSnapshot() ? '0' : '1')
    } catch {
      // ignore quota / private mode
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={motionOn}
        aria-label={motionOn ? 'motion: on' : 'motion: off'}
        suppressHydrationWarning
        className="lf-motion-switch mt-2 font-mono text-[11px] tracking-wide text-[var(--house-muted)]"
        onClick={onToggle}
      >
        <span className="lf-motion-on" aria-hidden="true">
          motion: on
        </span>
        <span className="lf-motion-off" aria-hidden="true">
          motion: off
        </span>
      </button>
      <script dangerouslySetInnerHTML={{ __html: ARIA_BOOTSTRAP }} />
    </>
  )
}
