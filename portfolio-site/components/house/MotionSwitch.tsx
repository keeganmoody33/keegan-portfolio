'use client'

import { useCallback, useLayoutEffect, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'lf-logo-paused'
const CHANGE_EVENT = 'lf-logo-paused'

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
 * Renders on the server as motion: on so there is no hydration mismatch
 * or CLS. sessionStorage is read via useSyncExternalStore
 * (`getServerSnapshot` is always playing). A parser-blocking head script
 * in `app/layout.tsx` sets `data-logo-paused` before first paint so the
 * mark never spins then freezes. This layout effect keeps `<html>` in
 * sync after hydration and toggles; it reads `getSnapshot()` so the
 * first pass does not clear the pre-paint pause. Pause is CSS-only via
 * `html[data-logo-paused="true"]` — never inline `animation-play-state`,
 * never `running`, so SignalCut's `data-lf-signal-cut` pause still holds
 * after a user resume and vice versa.
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
    <button
      type="button"
      role="switch"
      aria-checked={motionOn}
      className="lf-motion-switch mt-2 font-mono text-[11px] tracking-wide text-[var(--house-muted)]"
      onClick={onToggle}
    >
      motion: {motionOn ? 'on' : 'off'}
    </button>
  )
}
