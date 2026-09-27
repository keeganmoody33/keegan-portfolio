'use client'

import { useCallback, useSyncExternalStore, type ReactNode } from 'react'

const STORAGE_KEY = 'lf-logo-paused'
const CHANGE_EVENT = 'lf-logo-paused'

type LogoGlobePauseToggleProps = {
  children: ReactNode
}

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

/**
 * WCAG 2.2.2 pause control for the title-card coin spin.
 * Renders the button on the server (default = playing) so there is no
 * hydration mismatch or CLS. sessionStorage is read via
 * useSyncExternalStore (`getServerSnapshot` is always playing).
 * Pause is CSS-only via `data-logo-paused` — never inline
 * `animation-play-state`, so SignalCut's `data-lf-signal-cut` pause
 * still holds after a user resume and vice versa.
 */
export default function LogoGlobePauseToggle({
  children,
}: LogoGlobePauseToggleProps) {
  const paused = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const onToggle = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, getSnapshot() ? '0' : '1')
    } catch {
      // ignore quota / private mode
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return (
    <div className="lf-logo-lockup mb-6" data-logo-paused={paused ? 'true' : 'false'}>
      {children}
      <button
        type="button"
        className="lf-logo-pause"
        aria-label={paused ? 'Play logo animation' : 'Pause logo animation'}
        onClick={onToggle}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
    </div>
  )
}

function PauseIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 12 12"
      width="12"
      height="12"
    >
      <rect x="2" y="2" width="2.5" height="8" fill="currentColor" />
      <rect x="7.5" y="2" width="2.5" height="8" fill="currentColor" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 12 12"
      width="12"
      height="12"
    >
      <path d="M3.5 2.2v7.6L10 6z" fill="currentColor" />
    </svg>
  )
}
