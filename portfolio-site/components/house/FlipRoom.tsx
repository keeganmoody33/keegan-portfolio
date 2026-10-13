'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import { posthog, getPostHogDistinctIdHeader } from '@/lib/posthog-client'
import { FLIP_COPY, FLIP_SAMPLE_CAP, PRODUCT_MAILTO, showAllLabel, sourceLine } from '@/lib/flip/copy.ts'
import { parseFlipStub } from '@/lib/flip/fixtures.ts'
import { artistYearLine, parseLookupResult } from '@/lib/flip/result.ts'
import type { FlipLookupResult, FlipSampleRow, FlipStub } from '@/lib/flip/types.ts'

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)]'

const fieldClass =
  'w-full border-0 border-b border-[var(--house-line)] bg-transparent py-2 font-mono text-sm text-[var(--house-ink)] outline-none placeholder:text-[var(--house-dim)] focus-visible:border-[var(--house-ink)]'

type FormError = string | null

const DOWN_RESULT: FlipLookupResult = {
  status: 'down',
  fixture: false,
  checked: null,
  song: null,
  samples: [],
  sampledIn: [],
}

async function fetchLookup(q: string, nextStub: FlipStub | null): Promise<FlipLookupResult> {
  const url = new URL('/api/flip/lookup', window.location.origin)
  if (q) url.searchParams.set('q', q)
  if (nextStub) url.searchParams.set('stub', nextStub)
  const response = await fetch(url, {
    headers: { ...getPostHogDistinctIdHeader() },
    cache: 'no-store',
  })
  const json: unknown = await response.json()
  return parseLookupResult(json) ?? DOWN_RESULT
}

export function ProductInquiry() {
  return (
    <p className="house-source mt-10">
      {FLIP_COPY.productLead}{' '}
      <a
        href={PRODUCT_MAILTO}
        className={`inline-flex min-h-6 items-center hover:text-[var(--house-orange)] ${focusRing}`}
      >
        {FLIP_COPY.productEmail}
      </a>
    </p>
  )
}

export default function FlipRoom({
  track = '',
  stub: stubRaw = '',
}: {
  track?: string
  stub?: string
}) {
  const stub = parseFlipStub(stubRaw)
  const initialTrack = track.trim()

  const [query, setQuery] = useState(initialTrack)
  const [lookup, setLookup] = useState<FlipLookupResult | null>(null)
  const [looking, setLooking] = useState(() => Boolean(stub || initialTrack))
  const [submitted, setSubmitted] = useState(stub === 'success')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [formError, setFormError] = useState<FormError>(null)
  const [sending, setSending] = useState(false)
  const [showAllSamples, setShowAllSamples] = useState(false)
  const [showAllSampled, setShowAllSampled] = useState(false)

  const resultsId = useId()
  const privacyId = useId()
  const errorId = useId()

  async function runLookup(q: string, nextStub: FlipStub | null) {
    setLooking(true)
    setFormError(null)
    setSubmitted(nextStub === 'success')
    setShowAllSamples(false)
    setShowAllSampled(false)
    try {
      const result = await fetchLookup(q, nextStub)
      setLookup(result)
      posthog.capture('flip_lookup', {
        status: result.status,
        fixture: result.fixture,
      })
    } catch {
      setLookup(DOWN_RESULT)
    } finally {
      setLooking(false)
    }
  }

  useEffect(() => {
    if (!stub && !initialTrack) return undefined
    let cancelled = false
    void fetchLookup(initialTrack, stub)
      .then((result) => {
        if (cancelled) return
        setLookup(result)
        setSubmitted(stub === 'success')
        setLooking(false)
        posthog.capture('flip_lookup', {
          status: result.status,
          fixture: result.fixture,
        })
      })
      .catch(() => {
        if (cancelled) return
        setLookup(DOWN_RESULT)
        setLooking(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialTrack, stub])

  function onLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void runLookup(query.trim(), stub)
  }

  async function onRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lookup?.song) return
    setSending(true)
    setFormError(null)
    try {
      const response = await fetch('/api/flip/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getPostHogDistinctIdHeader(),
        },
        body: JSON.stringify({
          rid: lookup.song.rid,
          title: lookup.song.title,
          artist: lookup.song.artist,
          year: lookup.song.year,
          isrc: lookup.song.isrc,
          email,
          phone,
          smsOptIn,
          stub: stub ?? undefined,
        }),
      })
      const json: unknown = await response.json()
      const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
      if (!response.ok || rec.ok !== true) {
        const error = typeof rec.error === 'string' ? rec.error : FLIP_COPY.storeDown
        setFormError(error)
        return
      }
      setSubmitted(true)
      posthog.capture('flip_request', {
        has_email: email.trim().length > 0,
        has_phone: phone.trim().length > 0,
        sms_opt_in: smsOptIn,
      })
    } catch {
      setFormError(FLIP_COPY.storeDown)
    } finally {
      setSending(false)
    }
  }

  const song = lookup?.song ?? null
  const showForm = lookup?.status === 'ok' && song !== null && !submitted
  const phoneVisible = phone.trim().length > 0

  return (
    <div className="mt-10">
      <form onSubmit={onLookup} className="max-w-xl" aria-controls={resultsId}>
        <label className="house-meta" htmlFor="flip-lookup">
          {FLIP_COPY.lookup}
        </label>
        <div className="mt-2 flex items-baseline gap-4">
          <input
            id="flip-lookup"
            name="q"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={200}
            autoComplete="off"
            aria-label={FLIP_COPY.lookupAria}
            className={`min-w-0 flex-1 ${fieldClass}`}
          />
          <button
            type="submit"
            className={`house-text-button shrink-0 ${looking ? 'opacity-60' : ''}`}
            disabled={looking}
            aria-busy={looking}
          >
            {FLIP_COPY.lookupButton}
          </button>
        </div>
      </form>

      <div id={resultsId} className="house-fade mt-10" aria-live="polite">
        {lookup?.status === 'down' ? (
          <div>
            <p className="font-mono text-sm text-[var(--house-dim)]">{FLIP_COPY.down}</p>
            <button
              type="button"
              className="house-text-button mt-3"
              onClick={() => void runLookup(query.trim(), stub)}
            >
              {FLIP_COPY.retry}
            </button>
          </div>
        ) : null}

        {lookup?.status === 'no_match' ? (
          <p className="font-mono text-sm text-[var(--house-dim)]">{FLIP_COPY.noMatch}</p>
        ) : null}

        {lookup?.status === 'ok' && song ? (
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] sm:text-4xl">
              {song.title}
            </h2>
            <p className="mt-2 text-sm text-[var(--house-muted)] [overflow-wrap:anywhere]">{song.artist}</p>
            {song.year ? (
              <p className="mt-1 font-mono text-[11px] text-[var(--house-dim)]">{song.year}</p>
            ) : null}
            {song.isrc ? (
              <p className="mt-3 font-mono text-[11px] text-[var(--house-dim)]">{song.isrc}</p>
            ) : null}
            <p className="house-source mt-4">{sourceLine(lookup.checked, lookup.fixture)}</p>

            <div className="mt-10 grid gap-10 xl:grid-cols-2 xl:gap-16">
              <SampleColumn
                label={FLIP_COPY.samples}
                rows={lookup.samples}
                expanded={showAllSamples}
                onExpand={() => setShowAllSamples(true)}
              />
              <SampleColumn
                label={FLIP_COPY.sampledIn}
                rows={lookup.sampledIn}
                expanded={showAllSampled}
                onExpand={() => setShowAllSampled(true)}
              />
            </div>
          </div>
        ) : null}
      </div>

      {showForm ? (
        <form onSubmit={onRequest} className="mt-12 max-w-xl">
          <div>
            <label className="house-meta" htmlFor="flip-email">
              {FLIP_COPY.email}
            </label>
            <input
              id="flip-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={`mt-2 ${fieldClass}`}
            />
          </div>
          <div className="mt-8">
            <label className="house-meta" htmlFor="flip-phone">
              {FLIP_COPY.phone}
            </label>
            <input
              id="flip-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={`mt-2 ${fieldClass}`}
            />
          </div>
          {phoneVisible ? (
            <label className="mt-6 flex min-h-11 items-center gap-3 font-mono text-sm text-[var(--house-muted)] sm:min-h-8">
              <input
                type="checkbox"
                checked={smsOptIn}
                onChange={(event) => setSmsOptIn(event.target.checked)}
                className={`h-4 w-4 shrink-0 accent-[var(--house-ink)] ${focusRing}`}
              />
              {FLIP_COPY.smsOptIn}
            </label>
          ) : null}
          {formError ? (
            <p id={errorId} className="mt-6 font-mono text-sm text-[var(--house-dim)]" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            className={`house-text-button mt-8 ${sending ? 'opacity-60' : ''}`}
            disabled={sending}
            aria-describedby={privacyId}
            aria-busy={sending}
          >
            {FLIP_COPY.submit}
          </button>
          <p id={privacyId} className="mt-3 font-mono text-[11px] leading-relaxed text-[var(--house-dim)]">
            {FLIP_COPY.privacy}
          </p>
        </form>
      ) : null}

      {submitted && lookup?.status === 'ok' ? (
        <p className="mt-12 font-mono text-sm text-[var(--house-ink)]" role="status">
          {FLIP_COPY.success}
        </p>
      ) : null}

      <ProductInquiry />
    </div>
  )
}

function SampleColumn({
  label,
  rows,
  expanded,
  onExpand,
}: {
  label: string
  rows: FlipSampleRow[]
  expanded: boolean
  onExpand: () => void
}) {
  const visible = expanded || rows.length <= FLIP_SAMPLE_CAP ? rows : rows.slice(0, FLIP_SAMPLE_CAP)
  const remainder = rows.length - visible.length

  return (
    <section>
      <h3 className="house-meta">
        {label}
        <span className="ml-2 normal-case tracking-[0.16em] text-[var(--house-dim)]">{rows.length}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 font-mono text-sm text-[var(--house-dim)]">{FLIP_COPY.empty}</p>
      ) : (
        <ul className="mt-3 list-none p-0">
          {visible.map((row, index) => {
            const meta = artistYearLine(row)
            return (
              <li
                key={`${row.title}-${row.artist}-${index}`}
                className="border-t border-[var(--house-line)] py-3 last:border-b"
              >
                <p className="min-w-0 text-sm text-[var(--house-ink)] [overflow-wrap:anywhere]">{row.title}</p>
                {meta ? (
                  <p className="mt-1 font-mono text-[11px] text-[var(--house-dim)] [overflow-wrap:anywhere]">
                    {meta}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {remainder > 0 ? (
        <button type="button" className="house-text-button mt-3" onClick={onExpand}>
          {showAllLabel(rows.length)}
        </button>
      ) : null}
    </section>
  )
}
