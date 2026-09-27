'use client'

import { useCallback, useLayoutEffect, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'lf-logo-paused'
const CHANGE_EVENT = 'lf-logo-paused'

const ARIA_BOOTSTRAP = `try{var s=document.currentScript;var b=s&&s.previousElementSibling;if(b){var p=document.documentElement.getAttribute('data-logo-paused')==='true';b.setAttribute('aria-checked',p?'false':'true');b.setAttribute('aria-label',p?'motion: off':'motion: on');}}catch(e){}`

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

function syncSwitchFromHtml(): void {
  const paused = document.documentElement.getAttribute('data-logo-paused') === 'true'
  document.querySelectorAll('.lf-motion-switch').forEach((node) => {
    node.setAttribute('aria-checked', paused ? 'false' : 'true')
    node.setAttribute('aria-label', paused ? 'motion: off' : 'motion: on')
  })
}

function applyHtmlPaused(paused: boolean): void {
  if (paused) {
    document.documentElement.setAttribute('data-logo-paused', 'true')
  } else {
    document.documentElement.removeAttribute('data-logo-paused')
  }
  syncSwitchFromHtml()
}

/**
 * WCAG 2.2.2 pause control for the title-card coin spin.
 * Lives in the shared house footer (not next to the decorative mark).
 * Both labels are in the SSR markup; CSS on `html[data-logo-paused]`
 * picks the visible word before paint so a reload with motion off does
 * not flash "motion: on". Grid-stacked spans reserve the wider "off"
 * width. `aria-checked` and `aria-label` are not React props — the
 * parser-blocking head script and a sibling script write them on the
 * button from `html[data-logo-paused]`. `suppressHydrationWarning` on
 * the button silences the `next dev` mismatch (React omits those
 * attributes; the script has already set them). It only covers this
 * element's own attributes and text; visible labels stay in CSS child
 * spans the script does not rewrite. `suppressHydrationWarning` on
 * `<html>` does not cover this node. React must never bind
 * `aria-checked` / `aria-label` after hydration: the toggle handler
 * writes them on the DOM, and a re-render with those props would
 * reset a toggle. Hidden words are `aria-hidden`. Pause is CSS-only
 * via `html[data-logo-paused="true"]` — never inline
 * `animation-play-state`, never `running`.
 */
export default function MotionSwitch() {
  const paused = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useLayoutEffect(() => {
    applyHtmlPaused(getSnapshot())
  }, [paused])

  const onToggle = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, getSnapshot() ? '0' : '1')
    } catch {
      // ignore quota / private mode
    }
    applyHtmlPaused(getSnapshot())
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return (
    <>
      {/* eslint-disable jsx-a11y/role-has-required-aria-props -- keyed off html[data-logo-paused]; not React props */}
      <button
        type="button"
        role="switch"
        className="lf-motion-switch mt-2 font-mono text-[11px] tracking-wide text-[var(--house-muted)]"
        onClick={onToggle}
        suppressHydrationWarning
      >
        <span className="lf-motion-on" aria-hidden="true">
          motion: on
        </span>
        <span className="lf-motion-off" aria-hidden="true">
          motion: off
        </span>
      </button>
      {/* eslint-enable jsx-a11y/role-has-required-aria-props */}
      <script dangerouslySetInnerHTML={{ __html: ARIA_BOOTSTRAP }} />
    </>
  )
}
