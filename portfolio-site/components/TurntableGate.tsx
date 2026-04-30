'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'

const VISITED_KEY = 'lf-visited'
const PLAYER_READY_EVENT = 'youtube-player-ready'
const NEEDLE_DROP_EVENT = 'turntable:needle-drop'

type GateState = 'checking' | 'visible' | 'hidden'

export default function TurntableGate() {
  const [gateState, setGateState] = useState<GateState>('checking')
  const [playerReady, setPlayerReady] = useState(false)
  const [needleDropped, setNeedleDropped] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isReturnVisitor = localStorage.getItem(VISITED_KEY) === 'true'

    if (prefersReducedMotion || isReturnVisitor) {
      if (prefersReducedMotion) {
        posthog.capture('turntable_reduced_motion_bypassed')
      }
      setGateState('hidden')
      return
    }

    setGateState('visible')
    posthog.capture('turntable_loaded')
  }, [])

  useEffect(() => {
    const handlePlayerReady = () => setPlayerReady(true)

    if (window.__lfYouTubePlayerReady) {
      setPlayerReady(true)
    }

    window.addEventListener(PLAYER_READY_EVENT, handlePlayerReady)
    return () => window.removeEventListener(PLAYER_READY_EVENT, handlePlayerReady)
  }, [])

  const enterPortfolio = (delay = 900) => {
    setExiting(true)
    window.setTimeout(() => setGateState('hidden'), delay)
  }

  const handleNeedleDrop = () => {
    if (!playerReady || needleDropped) return

    setNeedleDropped(true)
    localStorage.setItem(VISITED_KEY, 'true')
    window.dispatchEvent(new CustomEvent(NEEDLE_DROP_EVENT))

    posthog.capture('turntable_needle_dropped', {
      player_ready: playerReady,
    })

    enterPortfolio(1400)
  }

  const handleSkip = () => {
    localStorage.setItem(VISITED_KEY, 'true')
    posthog.capture('turntable_skipped')
    enterPortfolio(500)
  }

  if (gateState !== 'visible') return null

  return (
    <section
      className={`
        fixed inset-0 z-[100] flex min-h-screen items-center justify-center
        overflow-hidden bg-[var(--bg-body)] px-6 py-10 transition-opacity duration-700
        ${exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}
      aria-label="Turntable entry experience"
    >
      <div className="absolute inset-0 opacity-80" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--border-dim)] bg-[radial-gradient(circle,rgba(204,255,0,0.10)_0%,rgba(204,255,0,0.02)_38%,transparent_68%)]" />
        <div className="absolute bottom-8 left-8 font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--text-muted)]">
          lecturesfrom / entry system
        </div>
      </div>

      <div className="relative z-10 grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="turntable-perspective mx-auto w-full max-w-xl">
          <div className="turntable-deck relative mx-auto aspect-[1.35/1] w-full rounded-2xl border border-[var(--border-dim)] bg-[var(--bg-surface)] shadow-[18px_18px_0_0_rgba(204,255,0,0.10)]">
            <div className="absolute left-[10%] top-[10%] aspect-square w-[62%] rounded-full border border-[var(--border-dim)] bg-[#0a0a0a] p-5">
              <div className="turntable-record relative h-full w-full rounded-full border border-black bg-[repeating-radial-gradient(circle,#050505_0,#050505_7px,#111_8px,#111_9px)]">
                <div className="absolute inset-[34%] rounded-full border border-[var(--accent-orange)] bg-[var(--bg-surface)]" />
                <div className="absolute inset-[45%] rounded-full bg-[var(--accent-lime)]" />
              </div>
            </div>

            <div className="absolute right-[15%] top-[17%] h-12 w-12 rounded-full border border-[var(--border-dim)] bg-[var(--bg-body)]" />
            <div
              className={`
                turntable-tonearm absolute right-[17%] top-[21%] h-[46%] w-3 origin-top rounded-full
                bg-[var(--text-muted)] transition-transform duration-700 ease-out
                ${needleDropped ? 'turntable-tonearm-dropped' : ''}
              `}
              aria-hidden="true"
            >
              <div className="absolute bottom-[-12px] left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 border border-[var(--accent-lime)] bg-[var(--bg-body)]" />
            </div>

            <button
              type="button"
              onClick={handleNeedleDrop}
              disabled={!playerReady || needleDropped}
              className={`
                absolute bottom-7 right-7 rounded border px-5 py-3 font-mono text-xs uppercase tracking-widest
                transition-all duration-200
                ${playerReady
                  ? 'border-[var(--accent-lime)] text-[var(--accent-lime)] hover:bg-[var(--accent-lime)] hover:text-[var(--bg-body)]'
                  : 'cursor-wait border-[var(--border-dim)] text-[var(--text-muted)]'
                }
              `}
              aria-label="Press Enter to start music and enter portfolio"
            >
              {needleDropped ? 'needle down' : playerReady ? 'drop needle' : 'warming wax'}
            </button>
          </div>
        </div>

        <div className="max-w-lg">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.35em] text-[var(--accent-orange)]">
            first press matters
          </p>
          <h1 className="mb-6 text-5xl font-bold leading-tight text-[var(--text-bright)] lg:text-7xl">
            Put the record on.
          </h1>
          <p className="mb-8 max-w-md text-lg text-[var(--text-muted)]">
            The needle drop starts the music and opens the portfolio. The player keeps running in the banner once you are inside.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleNeedleDrop}
              disabled={!playerReady || needleDropped}
              className="sketch-btn border border-[var(--border-dim)] px-6 py-3 font-mono text-sm uppercase tracking-wider text-[var(--text-bright)] disabled:cursor-wait disabled:opacity-50"
            >
              {playerReady ? 'Start with sound' : 'Cueing player...'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:text-[var(--text-bright)]"
            >
              silence is a choice
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
