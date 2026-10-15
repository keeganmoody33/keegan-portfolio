'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'
import CollectionGrid from '@/components/house/CollectionGrid'
import { saveCollectionScroll } from '@/components/house/RecordDetail'
import type { CoverManifest } from '@/lib/crate/cover-display'
import type { DiscogsRelease } from '@/lib/discogs'
import { posthog } from '@/lib/posthog-client'
import { CRATE_PULL_ONE_ID, pickListedId, shuffledCopy } from '@/lib/shuffle'
import { filterCollection } from '@/lib/collection-search'

function subscribeNever(): () => void {
  return () => {}
}

function useHasJavaScript(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false)
}

export default function CollectionCrate({
  releases,
  pullOneHref,
  covers = {},
}: {
  releases: DiscogsRelease[]
  pullOneHref: string | null
  covers?: Record<string, CoverManifest>
}) {
  const router = useRouter()
  const shuffleRef = useRef<HTMLButtonElement>(null)
  const [order, setOrder] = useState(releases)
  const [query, setQuery] = useState('')
  const visible = useMemo(() => filterCollection(order, query), [order, query])
  const ready = useHasJavaScript()
  const [announcement, setAnnouncement] = useState('')

  function shuffle() {
    setOrder(shuffledCopy(releases))
    setAnnouncement('')
    queueMicrotask(() => {
      setAnnouncement('record order shuffled')
    })
    shuffleRef.current?.focus()
    posthog.capture('collection_shuffle', { items: releases.length })
  }

  function pullOne(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const id = pickListedId(visible)
    if (id == null) return
    event.preventDefault()
    saveCollectionScroll(CRATE_PULL_ONE_ID)
    posthog.capture('collection_pull_one', { release_id: id })
    posthog.capture('collection_record_open', { release_id: id, source: 'pull_one' })
    router.push(`/collection/${id}`)
  }

  return (
    <>
      <div className="mt-8 max-w-xl" hidden={!ready || releases.length === 0}>
        <label htmlFor="collection-search" className="block font-mono text-sm">find a record</label>
        <input
          id="collection-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="artist, title, year, label, or catalog number"
          aria-controls="crate-grid"
          className="mt-3 min-h-12 w-full border border-[var(--house-muted)] bg-transparent px-3 py-3 font-mono text-sm text-[var(--house-ink)] placeholder:text-[var(--house-muted)]"
        />
        <p className="mt-3 font-mono text-sm text-[var(--house-muted)]" role="status">
          {query.trim() ? `${visible.length} of ${releases.length} records` : `${releases.length} records to explore`}
        </p>
        {query.trim() && visible.length === 0 ? <p className="mt-2 font-mono text-sm">no records match. try fewer words or clear the search.</p> : null}
        {query ? <button type="button" className="house-text-button" onClick={() => setQuery('')}>clear search</button> : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
        <button
          ref={shuffleRef}
          type="button"
          hidden={!ready || visible.length < 2}
          className="house-text-button"
          aria-controls="crate-grid"
          onClick={shuffle}
        >
          shuffle records
        </button>
        {pullOneHref && visible.length > 0 ? (
          <Link
            id={CRATE_PULL_ONE_ID}
            href={query.trim() ? `/collection/${visible[0].releaseId}` : pullOneHref}
            scroll={false}
            prefetch={false}
            className="house-text-button"
            onClick={pullOne}
          >
            open a random record
          </Link>
        ) : null}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </div>
      <CollectionGrid releases={visible} covers={covers} />
    </>
  )
}
