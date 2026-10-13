'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { posthog, getPostHogDistinctIdHeader } from '@/lib/posthog-client'
import {
  FLIP_COPY,
  FLIP_SAMPLE_CAP,
  PRODUCT_MAILTO,
  showAllLabel,
  songFieldLabel,
  sourceLine,
} from '@/lib/flip/copy.ts'
import { parseFlipStub } from '@/lib/flip/fixtures.ts'
import { validateFlipRequest } from '@/lib/flip/validate.ts'
import { artistYearLine, parseLookupResult, parseSearchResult } from '@/lib/flip/result.ts'
import {
  FLIP_SEARCH_MIN_CHARS,
  type FlipLookupResult,
  type FlipSampleRow,
  type FlipSearchResult,
  type FlipSong,
  type FlipStub,
} from '@/lib/flip/types.ts'

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)]'

const fieldClass =
  'w-full border-0 border-b border-[var(--house-line)] bg-transparent py-2 font-mono text-sm text-[var(--house-ink)] outline-none placeholder:text-[var(--house-dim)] focus-visible:border-[var(--house-ink)]'

const SEARCH_DEBOUNCE_MS = 300

type FormError = string | null

const DOWN_RESULT: FlipLookupResult = {
  status: 'down',
  fixture: false,
  checked: null,
  song: null,
  samples: [],
  sampledIn: [],
}

const DOWN_SEARCH: FlipSearchResult = { status: 'down', fixture: false, hits: [] }

async function fetchSearch(q: string, nextStub: FlipStub | null): Promise<FlipSearchResult> {
  const url = new URL('/api/flip/search', window.location.origin)
  if (q) url.searchParams.set('q', q)
  if (nextStub) url.searchParams.set('stub', nextStub)
  const response = await fetch(url, {
    headers: { ...getPostHogDistinctIdHeader() },
    cache: 'no-store',
  })
  const json: unknown = await response.json()
  return parseSearchResult(json) ?? DOWN_SEARCH
}

async function fetchLookup(
  song: { title?: string; artist?: string; q?: string },
  nextStub: FlipStub | null
): Promise<FlipLookupResult> {
  const url = new URL('/api/flip/lookup', window.location.origin)
  if (song.title) url.searchParams.set('title', song.title)
  if (song.artist) url.searchParams.set('artist', song.artist)
  if (song.q) url.searchParams.set('q', song.q)
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
    <section className="mt-16 max-w-xl border-t border-[var(--house-line)] pt-10">
      <h2 className="house-meta">{FLIP_COPY.connect}</h2>
      <p className="mt-3 font-mono text-sm text-[var(--house-muted)]">{FLIP_COPY.connectLede}</p>
      <p className="house-source mt-4">
        <a
          href={PRODUCT_MAILTO}
          className={`inline-flex min-h-6 items-center hover:text-[var(--house-orange)] ${focusRing}`}
        >
          {FLIP_COPY.productEmail}
        </a>
      </p>
    </section>
  )
}

export default function FlipRoom({
  track = '',
  title: titleParam = '',
  artist: artistParam = '',
  stub: stubRaw = '',
}: {
  track?: string
  title?: string
  artist?: string
  stub?: string
}) {
  const stub = parseFlipStub(stubRaw)
  const initialTitle = titleParam.trim()
  const initialArtist = artistParam.trim()
  const initialTrack = track.trim()
  const hasPickedDeepLink = initialTitle.length > 0 && initialArtist.length > 0
  const autoStub = stub !== null && stub !== 'suggest'

  const [query, setQuery] = useState(() => {
    if (hasPickedDeepLink) return initialTitle
    return initialTrack
  })
  const [hits, setHits] = useState<FlipSong[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [searching, setSearching] = useState(false)
  const [lookup, setLookup] = useState<FlipLookupResult | null>(null)
  const [looking, setLooking] = useState(() => Boolean(autoStub || hasPickedDeepLink))
  const [submitted, setSubmitted] = useState(stub === 'success')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [formError, setFormError] = useState<FormError>(null)
  const [sending, setSending] = useState(false)
  const [showAllSamples, setShowAllSamples] = useState(false)
  const [showAllSampled, setShowAllSampled] = useState(false)

  const skipSearchRef = useRef(hasPickedDeepLink || autoStub)
  const blurTimer = useRef<number | null>(null)

  const resultsId = useId()
  const listId = useId()
  const privacyId = useId()
  const errorId = useId()
  const hintId = useId()
  const contactHintId = useId()

  async function runLookupForSong(song: FlipSong) {
    skipSearchRef.current = true
    setLooking(true)
    setFormError(null)
    setSubmitted(stub === 'success')
    setShowAllSamples(false)
    setShowAllSampled(false)
    setOpen(false)
    setHits([])
    setQuery(song.title)
    try {
      const result = await fetchLookup({ title: song.title, artist: song.artist }, stub)
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

  async function runSearch(q: string): Promise<FlipSearchResult> {
    setSearching(true)
    try {
      const result = await fetchSearch(q, stub)
      if (result.status === 'down') {
        setHits([])
        setOpen(false)
        setLookup(DOWN_RESULT)
        return result
      }
      setHits(result.hits)
      setActiveIndex(0)
      setOpen(result.hits.length > 0)
      if (result.status === 'no_match') {
        setLookup({
          status: 'no_match',
          fixture: result.fixture,
          checked: null,
          song: null,
          samples: [],
          sampledIn: [],
        })
      } else if (lookup?.status === 'no_match' || lookup?.status === 'down') {
        setLookup(null)
      }
      posthog.capture('flip_search', {
        status: result.status,
        hits: result.hits.length,
        fixture: result.fixture,
      })
      return result
    } catch {
      setHits([])
      setOpen(false)
      setLookup(DOWN_RESULT)
      return DOWN_SEARCH
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (!autoStub && !hasPickedDeepLink && !initialTrack) return undefined
    let cancelled = false
    skipSearchRef.current = true

    const boot = async () => {
      if (hasPickedDeepLink) {
        const result = await fetchLookup({ title: initialTitle, artist: initialArtist }, stub)
        if (cancelled) return
        setLookup(result)
        setSubmitted(stub === 'success')
        setLooking(false)
        posthog.capture('flip_lookup', {
          status: result.status,
          fixture: result.fixture,
        })
        return
      }
      if (autoStub) {
        const result = await fetchLookup(
          initialTitle && initialArtist
            ? { title: initialTitle, artist: initialArtist }
            : { q: initialTrack },
          stub
        )
        if (cancelled) return
        setLookup(result)
        setSubmitted(stub === 'success')
        setLooking(false)
        posthog.capture('flip_lookup', {
          status: result.status,
          fixture: result.fixture,
        })
        return
      }
      const search = await fetchSearch(initialTrack, stub)
      if (cancelled) return
      if (search.status === 'down') {
        setLookup(DOWN_RESULT)
        setLooking(false)
        return
      }
      if (search.hits.length === 1) {
        const result = await fetchLookup(
          { title: search.hits[0]!.title, artist: search.hits[0]!.artist },
          stub
        )
        if (cancelled) return
        setLookup(result)
        setQuery(search.hits[0]!.title)
        posthog.capture('flip_lookup', {
          status: result.status,
          fixture: result.fixture,
        })
      } else {
        setHits(search.hits)
        setOpen(search.hits.length > 0)
        setActiveIndex(0)
        if (search.hits.length === 0) {
          setLookup({
            status: 'no_match',
            fixture: search.fixture,
            checked: null,
            song: null,
            samples: [],
            sampledIn: [],
          })
        }
      }
      setLooking(false)
    }

    void boot().catch(() => {
      if (cancelled) return
      setLookup(DOWN_RESULT)
      setLooking(false)
    })
    return () => {
      cancelled = true
    }
  }, [autoStub, hasPickedDeepLink, initialArtist, initialTitle, initialTrack, stub])

  useEffect(() => {
    if (skipSearchRef.current) return undefined
    const q = query.trim()
    if (q.length < FLIP_SEARCH_MIN_CHARS) return undefined
    const timer = window.setTimeout(() => {
      void runSearch(q)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
    // runSearch is stable enough for debounce; query is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function pickHit(song: FlipSong) {
    void runLookupForSong(song)
  }

  async function onLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = query.trim()
    if (!q) return
    skipSearchRef.current = true
    const result = hits.length > 0 ? { status: 'ok' as const, fixture: false, hits } : await runSearch(q)
    if (result.hits.length === 1) {
      void runLookupForSong(result.hits[0]!)
      return
    }
    if (result.hits.length > 1) {
      setOpen(true)
      setActiveIndex(0)
    }
  }

  function onQueryChange(value: string) {
    skipSearchRef.current = false
    setQuery(value)
    if (value.trim().length < FLIP_SEARCH_MIN_CHARS) {
      setHits([])
      setOpen(false)
    }
    if (lookup && lookup.status !== 'ok') setLookup(null)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || hits.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % hits.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + hits.length) % hits.length)
    } else if (event.key === 'Enter' && hits.length > 1) {
      event.preventDefault()
      const song = hits[activeIndex]
      if (song) pickHit(song)
    }
  }

  async function onRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lookup?.song) return
    const contact = validateFlipRequest({
      rid: lookup.song.rid,
      title: lookup.song.title,
      artist: lookup.song.artist,
      year: lookup.song.year,
      isrc: lookup.song.isrc,
      email,
      phone,
      smsOptIn,
    })
    if (!contact.ok) {
      setFormError(contact.error)
      return
    }
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
  const hasContact = email.trim().length > 0 || phone.trim().length > 0
  const phoneVisible = phone.trim().length > 0
  const activeHit = hits[activeIndex]
  const busy = looking || searching

  return (
    <div className="mt-10">
      <form onSubmit={onLookup} className="max-w-xl" aria-controls={resultsId}>
        <label className="house-meta" htmlFor="flip-lookup">
          {FLIP_COPY.lookup}
        </label>
        <div className="relative mt-2">
          <input
            id="flip-lookup"
            name="q"
            type="text"
            role="combobox"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              if (hits.length > 0) setOpen(true)
            }}
            onBlur={() => {
              if (blurTimer.current) window.clearTimeout(blurTimer.current)
              blurTimer.current = window.setTimeout(() => setOpen(false), 120)
            }}
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
            placeholder={FLIP_COPY.lookupPlaceholder}
            aria-label={FLIP_COPY.lookupAria}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && activeHit ? `${listId}-${activeIndex}` : undefined}
            aria-describedby={hintId}
            className={fieldClass}
          />
          {open && hits.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-0 w-full list-none bg-[var(--house-bg)] p-0"
            >
              {hits.map((hit, index) => {
                const meta = artistYearLine(hit)
                const selected = index === activeIndex
                return (
                  <li key={`${hit.rid ?? hit.title}-${hit.artist}-${index}`} role="presentation">
                    <button
                      type="button"
                      role="option"
                      id={`${listId}-${index}`}
                      aria-selected={selected}
                      className={`w-full border-t border-[var(--house-line)] px-0 py-3 text-left last:border-b ${focusRing} ${
                        selected ? 'text-[var(--house-ink)]' : 'text-[var(--house-muted)]'
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => pickHit(hit)}
                    >
                      <p className="min-w-0 text-sm [overflow-wrap:anywhere]">{hit.title}</p>
                      {meta ? (
                        <p className="mt-1 font-mono text-[11px] text-[var(--house-dim)] [overflow-wrap:anywhere]">
                          {meta}
                        </p>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
        <p id={hintId} className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--house-dim)]">
          {FLIP_COPY.lookupHint}
        </p>
        {open && hits.length > 1 ? (
          <p className="mt-2 font-mono text-sm text-[var(--house-dim)]">{FLIP_COPY.pick}</p>
        ) : null}
        <button
          type="submit"
          className={`house-text-button mt-4 ${busy ? 'opacity-60' : ''}`}
          disabled={busy}
          aria-busy={busy}
        >
          {FLIP_COPY.lookupButton}
        </button>
      </form>

      <div id={resultsId} className="house-fade mt-10" aria-live="polite">
        {lookup?.status === 'down' ? (
          <div>
            <p className="font-mono text-sm text-[var(--house-dim)]">{FLIP_COPY.down}</p>
            <button
              type="button"
              className="house-text-button mt-3"
              onClick={() => {
                if (song) {
                  void runLookupForSong(song)
                  return
                }
                const q = query.trim()
                if (q) void runSearch(q)
              }}
            >
              {FLIP_COPY.retry}
            </button>
          </div>
        ) : null}

        {lookup?.status === 'no_match' && !open ? (
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
            <p className="sr-only">{songFieldLabel(song)}</p>
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
          <p id={contactHintId} className="mb-6 font-mono text-[11px] leading-relaxed text-[var(--house-dim)]">
            {FLIP_COPY.contactHint}
          </p>
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
              aria-describedby={contactHintId}
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
              aria-describedby={contactHintId}
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
            className={`house-text-button mt-8 ${sending || !hasContact ? 'opacity-60' : ''}`}
            disabled={sending || !hasContact}
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
