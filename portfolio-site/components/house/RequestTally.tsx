'use client'

import { useEffect, useId, useState } from 'react'
import posthog from 'posthog-js'
import {
  TALLY_CATEGORIES,
  TALLY_DEFINITIONS,
  TALLY_LABELS,
  type TallyCategory,
  type TallySnapshot,
} from '@/lib/tally'

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: TallySnapshot }

const fmt = (n: number) => n.toLocaleString('en-US')

function sinceLabel(iso: string | null): string {
  if (!iso) return 'since launch'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'since launch'
  return `since ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).toLowerCase()}`
}

/**
 * The footer's running tally of page requests served to presumed humans vs
 * automated clients. Counts come from /api/tally (server side, every page
 * request, classified by user agent). The breakdown opens inline, below the
 * row, so it never covers the page.
 */
export default function RequestTally() {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [human, setHuman] = useState(true)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<TallyCategory | null>(null)
  const panelId = useId()

  useEffect(() => {
    let cancelled = false
    fetch('/api/tally')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: TallySnapshot) => {
        if (!cancelled) setLoad({ state: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setLoad({ state: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ready = load.state === 'ready'
  const data = ready ? load.data : null
  const total = data ? data.presumedHuman + data.automated : 0
  const value = data ? (human ? data.presumedHuman : data.automated) : null
  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%')
  const line =
    value === null
      ? ''
      : `${fmt(value)} ${human ? 'presumed human' : 'automated'} requests ${sinceLabel(data?.since ?? null)}, ${pct(value)} of all traffic`

  const rows = data
    ? [...TALLY_CATEGORIES].sort((a, b) =>
        a === 'presumed_human' ? -1 : b === 'presumed_human' ? 1 : data.byCategory[b] - data.byCategory[a]
      )
    : []
  const max = data ? Math.max(1, ...TALLY_CATEGORIES.map((c) => data.byCategory[c])) : 1
  const selected: TallyCategory = picked ?? (human ? 'presumed_human' : rows.find((c) => c !== 'presumed_human') ?? 'undeclared')

  const toggle = (on: boolean) =>
    `flex min-h-11 items-center border-b uppercase tracking-[0.18em] transition-colors motion-reduce:transition-none motion-reduce:duration-0 hover:text-[var(--house-orange)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)] sm:min-h-8 ${
      on ? 'border-[var(--house-ink)] text-[var(--house-ink)]' : 'border-transparent text-[var(--house-muted)]'
    }`

  return (
    <div className="mt-7 border-t border-[var(--house-line)] font-[family-name:var(--house-font-mono)] text-[11px] text-[var(--house-muted)]">
      <span className="sr-only" aria-live="polite">
        {line}
      </span>
      <div
        className={`flex min-h-11 flex-wrap items-center justify-between gap-x-5 gap-y-1 ${ready ? '' : 'invisible'}`}
        inert={!ready}
        aria-hidden={!ready}
      >
        <span className="tracking-[0.02em]">tally · page requests {sinceLabel(data?.since ?? null)}</span>
        <span className="flex flex-wrap items-center gap-4">
          <span role="group" aria-label="Count to show" className="flex gap-3.5">
            <button
              type="button"
              aria-pressed={human}
              onClick={() => {
                setHuman(true)
                setPicked(null)
                posthog.capture('tally_mode_changed', { mode: 'human' })
              }}
              className={toggle(human)}
            >
              humans
            </button>
            <button
              type="button"
              aria-pressed={!human}
              onClick={() => {
                setHuman(false)
                setPicked(null)
                posthog.capture('tally_mode_changed', { mode: 'automated' })
              }}
              className={toggle(!human)}
            >
              not humans
            </button>
          </span>
          <span className="flex min-h-11 items-center gap-3 sm:min-h-8">
            <span
              aria-hidden="true"
              className="inline-block min-w-[8ch] bg-[var(--house-lcd)] px-1.5 py-0.5 text-center font-[family-name:var(--house-font-lcd)] text-[13px] font-extrabold leading-none tracking-[0.04em] text-[var(--house-lcd-ink)] tabular-nums"
            >
              {value === null ? '·······' : fmt(value)}
            </span>
            <button
              type="button"
              onClick={() => {
                posthog.capture('tally_breakdown_toggled', { open: !open })
                setOpen(!open)
              }}
              aria-expanded={open}
              aria-controls={panelId}
              className="inline-flex min-h-11 items-center uppercase tracking-[0.18em] text-[var(--house-ink)] underline underline-offset-[3px] transition-colors motion-reduce:transition-none motion-reduce:duration-0 hover:text-[var(--house-orange)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)] sm:min-h-8"
            >
              {open ? 'close' : 'breakdown'}
            </button>
          </span>
        </span>
      </div>

      {open && data ? (
        <div id={panelId} className="grid gap-x-10 gap-y-4 border-t border-[var(--house-line)] pt-4 pb-1 font-[family-name:var(--house-font-sans)] leading-relaxed text-[var(--house-ink)] md:grid-cols-[1.2fr_1fr]">
          <ul aria-label="Requests by type" className="m-0 list-none p-0 font-[family-name:var(--house-font-mono)]">
            {rows.map((c, i) => {
              const active = c === 'presumed_human' ? human : !human
              const on = c === selected
              return (
                <li key={c}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setPicked(c)
                      posthog.capture('tally_category_selected', { category: c })
                    }}
                    className={`grid min-h-11 w-full grid-cols-[22px_minmax(0,1fr)_40px_64px] items-center gap-2.5 text-left transition-colors motion-reduce:transition-none motion-reduce:duration-0 hover:text-[var(--house-orange)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)] sm:min-h-[26px] sm:grid-cols-[22px_minmax(0,1fr)_110px_64px] ${
                      active ? 'text-[var(--house-ink)]' : 'text-[var(--house-muted)]'
                    }`}
                  >
                    <span className="text-[10px] text-[var(--house-dim)]">{String(i).padStart(2, '0')}</span>
                    <span className={on ? 'underline underline-offset-[3px]' : ''}>{TALLY_LABELS[c]}</span>
                    <span className="relative h-0.5 bg-[var(--house-line)]" aria-hidden="true">
                      <span
                        className={`absolute inset-y-0 left-0 ${active ? 'bg-[var(--house-ink)]' : 'bg-[var(--house-dim)]'}`}
                        style={{ width: `${Math.round((data.byCategory[c] / max) * 100)}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums">{fmt(data.byCategory[c])}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-0.5 border-b border-[var(--house-line)] pb-2">
              <span>
                lecturesfrom.com has served {fmt(total)} page requests {sinceLabel(data.since)}
              </span>
              <span className="text-[var(--house-muted)]">
                {pct(data.presumedHuman)} presumed human · {pct(data.automated)} automated
              </span>
            </div>
            <p className="m-0 min-h-[52px] text-[var(--house-muted)]">
              <span className="text-[var(--house-ink)]">{TALLY_LABELS[selected]}</span> · {TALLY_DEFINITIONS[selected]}
              <br />
              spec id: {selected}
            </p>
            <p className="m-0 text-[var(--house-dim)]">
              counted on the server for every page request, classified by user agent. nothing is network verified yet, so a bot
              that claims to be a browser counts as human. assets and API calls excluded.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
