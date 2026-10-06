'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { posthog } from '@/lib/posthog-client'
import { CRATE_EMPTY_LINE, CRATE_PICK_TRACK, CRATE_UNAVAILABLE_LINE, type ResearchFact, type StoredPressing } from '@/lib/crate/types.ts'
import {
  checkedDate,
  checkedNoMatchLine,
  factRows,
  overviewConnections,
  pressingCheckedNoMatchLine,
  trackCreditFacts,
  trackSampleFacts,
  trackSampledByFacts,
} from '@/lib/crate/view.ts'
import DiscogsCredit from '@/components/house/DiscogsCredit'
import { coverageLine, isPlayableOccurrence } from '@/lib/crate/lifecycle.ts'

const SCROLL_KEY = 'lf:collection:scroll'
const FOCUS_KEY = 'lf:collection:focus'

type TabId = 'overview' | 'tracks'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'overview' },
  { id: 'tracks', label: 'tracks' },
]

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)]'

export function saveCollectionScroll(focusId: string) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
  sessionStorage.setItem(FOCUS_KEY, focusId)
}

export function restoreCollectionScroll() {
  if (typeof window === 'undefined') return
  const y = sessionStorage.getItem(SCROLL_KEY)
  if (y) {
    window.scrollTo(0, Number.parseInt(y, 10) || 0)
    sessionStorage.removeItem(SCROLL_KEY)
  }
  const id = sessionStorage.getItem(FOCUS_KEY)
  if (id) {
    const node =
      document.getElementById(id) ?? document.getElementById(`crate-cover-${id}`)
    node?.focus({ preventScroll: true })
    sessionStorage.removeItem(FOCUS_KEY)
  }
}

export default function RecordDetail({
  pressing,
  mode,
  unavailable = false,
  crateSource,
}: {
  pressing: StoredPressing
  mode: 'page' | 'overlay'
  unavailable?: boolean
  crateSource?: 'redis' | 'fixture' | 'collection'
}) {
  const router = useRouter()
  const titleId = useId()
  const closeRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null)
  const [tab, setTab] = useState<TabId>('overview')
  const [selected, setSelected] = useState<number | null>(null)
  const facts = pressing.facts
  const connections = overviewConnections(pressing)
  const selectedTrack = selected == null ? null : pressing.tracks[selected]
  const selectedRecording =
    selectedTrack?.recording.mbid
      ? pressing.recordings[selectedTrack.recording.mbid]
      : undefined

  const extrasId = `track-extras-${pressing.releaseId}`
  const heading = unavailable
    ? facts.catno || String(facts.releaseId)
    : facts.title
  const placeholderCatno = facts.catno || String(facts.releaseId)

  const close = useCallback(() => {
    posthog.capture('collection_record_close', {
      release_id: pressing.releaseId,
      mode,
    })
    if (mode === 'overlay') {
      router.back()
      return
    }
    router.push('/collection')
    requestAnimationFrame(() => {
      document.getElementById('house-content')?.focus({ preventScroll: true })
    })
  }, [mode, pressing.releaseId, router])

  useEffect(() => {
    if (mode !== 'overlay') return undefined
    closeRef.current?.focus({ preventScroll: true })
    const nodes = document.querySelectorAll(
      '[data-collection-root], .house header, .house footer, .house-skip'
    )
    nodes.forEach((node) => {
      if (node instanceof HTMLElement) {
        node.setAttribute('inert', '')
        node.setAttribute('aria-hidden', 'true')
      }
    })
    return () => {
      nodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          node.removeAttribute('inert')
          node.removeAttribute('aria-hidden')
        }
      })
      restoreCollectionScroll()
    }
  }, [mode])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (selected != null) {
        event.preventDefault()
        setSelected(null)
        return
      }
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, selected])

  function selectTab(next: TabId, focus = false) {
    setTab(next)
    if (focus) {
      const button = document.getElementById(`tab-${next}`)
      if (button instanceof HTMLButtonElement) button.focus()
    }
    posthog.capture('collection_record_tab', {
      release_id: pressing.releaseId,
      tab: next,
    })
  }

  function onTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((item) => item.id === tab)
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const next = TABS[(current + delta + TABS.length) % TABS.length]
      if (next) selectTab(next.id, true)
    }
    if (event.key === 'Home') {
      event.preventDefault()
      selectTab('overview', true)
    }
    if (event.key === 'End') {
      event.preventDefault()
      selectTab('tracks', true)
    }
  }

  const shell = (
    <article
      className={`${mode === 'overlay' ? '' : 'house-fade '}px-6 py-12 sm:px-10`}
      aria-labelledby={titleId}
      data-crate-source={crateSource}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return
        event.currentTarget.style.opacity = '1'
      }}
    >
      <p className={`house-meta mb-8${mode === 'overlay' ? ' opacity-100' : ''}`}>
        {mode === 'overlay' ? (
          <button
            type="button"
            ref={(node) => {
              closeRef.current = node
            }}
            onClick={close}
            className={`hover:text-[var(--house-orange)] ${focusRing}`}
          >
            collection
          </button>
        ) : (
          <Link
            href="/collection"
            scroll={false}
            ref={(node) => {
              closeRef.current = node
            }}
            className={`hover:text-[var(--house-orange)] ${focusRing}`}
          >
            collection
          </Link>
        )}
        <span className="mx-3">/</span>
        {facts.catno || String(facts.releaseId)}
      </p>

      {unavailable && (
        <p className="mb-8 font-mono text-sm text-[var(--house-dim)]">
          {CRATE_UNAVAILABLE_LINE}{' '}
          <button
            type="button"
            onClick={() => router.refresh()}
            className={`hover:text-[var(--house-orange)] ${focusRing}`}
          >
            retry
          </button>
        </p>
      )}

      {unavailable ? (
      <div className="grid gap-10 min-[1280px]:grid-cols-2 min-[1280px]:items-start">
        <RecordCover
          src=""
          artist=""
          title={heading}
          catno={placeholderCatno}
        />
        <div>
          <h1
            id={titleId}
            className="font-display text-4xl font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] sm:text-6xl"
          >
            {heading}
          </h1>
        </div>
      </div>
      ) : (
      <div className="grid gap-10 min-[1280px]:grid-cols-2 min-[1280px]:items-start">
        <RecordCover
          src={facts.thumbnail || facts.cover}
          artist={facts.artist}
          title={facts.title}
          catno={placeholderCatno}
        />
        <div>
          <h1
            id={titleId}
            className="font-display text-4xl font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] sm:text-6xl"
          >
            {facts.title}
          </h1>
          {facts.artist ? (
            <p className="mt-3 text-[var(--house-muted)] [overflow-wrap:anywhere]">
              {facts.artist}
            </p>
          ) : null}

          <div
            role="tablist"
            aria-label="record"
            className="mt-8 flex gap-6 border-b border-[var(--house-line)]"
            onKeyDown={onTabKeyDown}
          >
            {TABS.map((item) => {
              const selectedTab = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-controls={`panel-${item.id}`}
                  aria-selected={selectedTab}
                  tabIndex={selectedTab ? 0 : -1}
                  className={`house-meta -mb-px border-b pb-2 ${focusRing} ${
                    selectedTab
                      ? 'border-[var(--house-ink)] text-[var(--house-ink)]'
                      : 'border-transparent text-[var(--house-muted)] hover:text-[var(--house-orange)]'
                  }`}
                  onClick={() => selectTab(item.id)}
                >
                  {item.label}
                </button>
              )
            })}
          </div>

          <div
            role="tabpanel"
            id="panel-overview"
            aria-labelledby="tab-overview"
            hidden={tab !== 'overview'}
            tabIndex={0}
            className={`pt-6 outline-none ${focusRing}`}
          >
              {pressing.description && (
                <div className="mb-8">
                  <p className="max-w-xl text-base leading-relaxed text-[var(--house-ink)]">
                    {pressing.description.text}
                  </p>
                </div>
              )}

              <dl>
                {factRows(pressing).map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-4 border-t border-[var(--house-line)] py-3 last:border-b"
                  >
                    <dt className="house-meta">{row.label}</dt>
                    <dd
                      className={
                        row.tone === 'dim'
                          ? 'font-mono text-sm text-[var(--house-dim)] [overflow-wrap:anywhere]'
                          : 'text-sm text-[var(--house-ink)] [overflow-wrap:anywhere]'
                      }
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {facts.discogsUrl && (
                <div className="mt-2">
                  <SourceLine source="discogs" href={facts.discogsUrl} />
                  <DiscogsCredit href={facts.discogsUrl} />
                </div>
              )}

              <section className="mt-10" aria-label="connections">
                <h2 className="house-meta mb-3">connections</h2>
                {connections.length === 0 ? (
                  <p className="house-source">
                    {pressingCheckedNoMatchLine(pressing) ?? CRATE_EMPTY_LINE}
                  </p>
                ) : (
                  <ul className="list-none p-0">
                    {connections.map((row) => (
                      <li
                        key={`${row.label}-${row.href}`}
                        className="border-t border-[var(--house-line)] py-3 last:border-b"
                      >
                        <p className="house-meta">{row.label}</p>
                        <a
                          href={row.href}
                          className={`mt-1 inline-block text-sm hover:text-[var(--house-orange)] ${focusRing}`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {row.title}
                        </a>
                        <SourceLine source={row.source} href={row.href} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

          <div
            role="tabpanel"
            id="panel-tracks"
            aria-labelledby="tab-tracks"
            hidden={tab !== 'tracks'}
            tabIndex={0}
            className={`pt-6 outline-none ${focusRing}`}
          >
              {pressing.tracks.length === 0 ? (
                <p className="font-mono text-sm text-[var(--house-dim)]">
                  {CRATE_EMPTY_LINE}
                </p>
              ) : (
                <>
                  {pressing.coverage ? (
                    <p className="house-meta mb-3">{coverageLine(pressing.coverage)}</p>
                  ) : null}
                  <ul className="list-none p-0">
                  {pressing.tracks.map((track, index) => {
                    const heading = !isPlayableOccurrence(track)
                    if (heading) {
                      return (
                        <li
                          key={`${track.position}-${track.index}`}
                          className="border-t border-[var(--house-line)] last:border-b"
                        >
                          <p className="house-meta py-3">{track.title}</p>
                        </li>
                      )
                    }
                    const active = selected === index
                    return (
                      <li key={`${track.position}-${track.index}`} className="border-t border-[var(--house-line)] last:border-b">
                        <button
                          type="button"
                          aria-expanded={active}
                          aria-controls={extrasId}
                          className={`grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-4 py-3 text-left ${focusRing} ${
                            active ? 'text-[var(--house-ink)]' : 'text-[var(--house-muted)]'
                          } hover:text-[var(--house-orange)]`}
                          onClick={() => {
                            setSelected(index)
                            posthog.capture('collection_record_track', {
                              release_id: pressing.releaseId,
                              position: track.position,
                            })
                          }}
                        >
                          <span className="font-mono text-[11px] text-[var(--house-dim)]">
                            {track.position}
                          </span>
                          <span className="min-w-0 text-sm">
                            <span className="text-[var(--house-dim)]" aria-hidden>
                              ·{' '}
                            </span>
                            {track.title}
                          </span>
                          {track.duration ? (
                            <span className="justify-self-end font-mono text-sm tabular-nums text-[var(--house-dim)]">
                              {track.duration}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                  </ul>
                </>
              )}

              <section
                className="mt-10"
                id={extrasId}
                aria-labelledby={selectedTrack ? `${extrasId}-heading` : undefined}
              >
                {selectedTrack == null ? (
                  <p className="font-mono text-sm text-[var(--house-dim)]">
                    {CRATE_PICK_TRACK}
                  </p>
                ) : (
                  <>
                    <h2
                      id={`${extrasId}-heading`}
                      className="mb-3 text-sm text-[var(--house-ink)]"
                    >
                      {selectedTrack.title}
                    </h2>
                    <TrackExtras
                      checked={checkedDate(
                        selectedRecording?.provenance.verifiedAt ??
                          selectedRecording?.provenance.checkedAt ??
                          pressing.lifecycles?.match.verifiedAt ??
                          pressing.provenance.verifiedAt ??
                          (pressing.provenance.lastError ? null : pressing.provenance.checkedAt)
                      )}
                      status={selectedTrack.recording.matchStatus}
                      reason={selectedTrack.recording.reason}
                      recording={selectedRecording}
                      recordingUrl={selectedTrack.recording.recordingUrl}
                      credits={trackCreditFacts(pressing, selectedTrack)}
                      samplesFrom={trackSampleFacts(pressing, selectedTrack)}
                      sampledIn={trackSampledByFacts(pressing, selectedTrack)}
                    />
                  </>
                )}
              </section>
            </div>
        </div>
      </div>
      )}
    </article>
  )

  if (mode === 'overlay') {
    return (
      <div
        className="fixed inset-0 z-30 overflow-auto bg-[var(--house-bg)] opacity-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {shell}
      </div>
    )
  }

  return shell
}

function RecordCover({
  src,
  artist,
  title,
  catno,
}: {
  src: string
  artist: string
  title: string
  catno: string | null
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${artist} — ${title}`}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="aspect-square w-full max-w-[480px] border border-[var(--house-line)] object-cover min-[1280px]:max-w-none"
      />
    )
  }
  return (
    <div className="flex aspect-square w-full max-w-[480px] items-center justify-center border border-[var(--house-line)] bg-[var(--house-line)] min-[1280px]:max-w-none">
      {catno ? (
        <p className="px-4 text-center font-mono text-sm text-[var(--house-ink)] [overflow-wrap:anywhere]">
          {catno}
        </p>
      ) : null}
    </div>
  )
}

function SourceLine({ source, href }: { source: string; href: string }) {
  return (
    <p className="house-source mt-2">
      <a
        href={href}
        className={`inline-flex min-h-6 items-center hover:text-[var(--house-orange)] ${focusRing}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className="sr-only">source </span>
        {source}
      </a>
    </p>
  )
}

function TrackExtras({
  checked,
  status,
  reason,
  recording,
  recordingUrl,
  credits,
  samplesFrom,
  sampledIn,
}: {
  checked: string | null
  status: string
  reason: string
  recording: StoredPressing['recordings'][string] | undefined
  recordingUrl: string | null
  credits: ResearchFact[]
  samplesFrom: ResearchFact[]
  sampledIn: ResearchFact[]
}) {
  const unmatched = status !== 'matched' || !recording
  const afterCheck = checkedNoMatchLine(status, reason, checked)
  const hasFacts = credits.length > 0 || samplesFrom.length > 0 || sampledIn.length > 0

  if (unmatched && !hasFacts) {
    return (
      <p className="house-source">
        {afterCheck ?? CRATE_EMPTY_LINE}
      </p>
    )
  }

  return (
    <div>
      {unmatched && afterCheck ? (
        <p className="house-source">{afterCheck}</p>
      ) : null}
      {recordingUrl && (
        <SourceLine source="musicbrainz" href={recordingUrl} />
      )}
      {checked && !unmatched ? (
        <p className="mt-2 font-mono text-[11px] text-[var(--house-dim)]">
          checked {checked}
        </p>
      ) : null}

      <h3 className="house-meta mt-8">credits</h3>
      {credits.length === 0 ? (
        <p className="mt-2 font-mono text-sm text-[var(--house-dim)]">{CRATE_EMPTY_LINE}</p>
      ) : (
        <ul className="mt-2 list-none p-0">
          {credits.map((credit, index) => (
            <li
              key={`${credit.role}-${credit.person}-${index}`}
              className="border-t border-[var(--house-line)] py-3 last:border-b"
            >
              <p className="text-sm">
                {credit.person}
                <span className="text-[var(--house-muted)]"> · {credit.role}</span>
              </p>
              <SourceLine source={credit.source} href={credit.sourceUrl} />
            </li>
          ))}
        </ul>
      )}

      <h3 className="house-meta mt-8">samples from</h3>
      <FactSampleList items={samplesFrom} />

      <h3 className="house-meta mt-8">sampled in</h3>
      <FactSampleList items={sampledIn} />
    </div>
  )
}

function FactSampleList({ items }: { items: ResearchFact[] }) {
  if (items.length === 0) {
    return <p className="mt-2 font-mono text-sm text-[var(--house-dim)]">{CRATE_EMPTY_LINE}</p>
  }
  return (
    <ul className="mt-2 list-none p-0">
      {items.map((item) => (
        <li key={`${item.sourceId}-${item.sourceUrl}`} className="border-t border-[var(--house-line)] py-3 last:border-b">
          <a
            href={item.sourceUrl}
            className={`inline-flex min-h-6 items-center text-sm hover:text-[var(--house-orange)] ${focusRing}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            {item.relatedArtist ? `${item.relatedArtist} — ${item.relatedTitle}` : item.relatedTitle}
          </a>
          <SourceLine source={item.source} href={item.sourceUrl} />
        </li>
      ))}
    </ul>
  )
}
