'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'
import CollectionGrid from '@/components/house/CollectionGrid'
import { saveCollectionScroll } from '@/components/house/RecordDetail'
import type { CoverManifest } from '@/lib/crate/cover-display'
import type { DiscogsRelease } from '@/lib/discogs'
import { posthog } from '@/lib/posthog-client'
import { CRATE_PULL_ONE_ID, pickListedId, shuffledCopy } from '@/lib/shuffle'

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
  const ready = useHasJavaScript()
  const [announcement, setAnnouncement] = useState('')

  function shuffle() {
    setOrder(shuffledCopy(releases))
    setAnnouncement('')
    queueMicrotask(() => {
      setAnnouncement('shuffled')
    })
    shuffleRef.current?.focus()
    posthog.capture('collection_shuffle', { items: releases.length })
  }

  function pullOne(event: MouseEvent<HTMLAnchorElement>) {
    const id = pickListedId(releases)
    if (id == null) return
    event.preventDefault()
    saveCollectionScroll(CRATE_PULL_ONE_ID)
    posthog.capture('collection_pull_one', { release_id: id })
    posthog.capture('collection_record_open', { release_id: id, source: 'pull_one' })
    router.push(`/collection/${id}`)
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          ref={shuffleRef}
          type="button"
          hidden={!ready || releases.length === 0}
          className="house-text-button"
          aria-controls="crate-grid"
          onClick={shuffle}
        >
          shuffle
        </button>
        {pullOneHref ? (
          <Link
            id={CRATE_PULL_ONE_ID}
            href={pullOneHref}
            scroll={false}
            prefetch={false}
            className="house-text-button"
            onClick={pullOne}
          >
            pull one
          </Link>
        ) : null}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </div>
      <CollectionGrid releases={order} covers={covers} />
    </>
  )
}
