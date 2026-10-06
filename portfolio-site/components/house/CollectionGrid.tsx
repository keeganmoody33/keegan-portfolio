'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import NoArtTile from '@/components/house/NoArtTile'
import { restoreCollectionScroll, saveCollectionScroll } from '@/components/house/RecordDetail'
import type { DiscogsRelease } from '@/lib/discogs'
import { posthog } from '@/lib/posthog-client'

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)]'

export default function CollectionGrid({
  releases,
}: {
  releases: DiscogsRelease[]
}) {
  useEffect(() => {
    restoreCollectionScroll()
  }, [])

  return (
    <ul
      id="crate-grid"
      className="mt-10 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      {releases.map((release, index) => {
        const releaseId = release.releaseId
        const src = release.thumbnail || release.cover
        const eager = index < 10
        const href = releaseId > 0 ? `/collection/${releaseId}` : release.discogsUrl
        const internal = releaseId > 0
        const year = release.year > 0 ? String(release.year) : null

        const cover = src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : undefined}
            decoding="async"
            className="aspect-square w-full border border-[var(--house-line)] object-cover"
          />
        ) : (
          <NoArtTile artist={release.artist} title={release.title} />
        )

        const caption = (
          <>
            <p className="mt-2 font-mono text-[11px] leading-snug text-[var(--house-ink)] group-hover:text-[var(--house-orange)]">
              {release.artist}
            </p>
            <p className="font-mono text-[11px] text-[var(--house-muted)]">{release.title}</p>
            {year ? <p className="house-meta mt-1">{year}</p> : null}
          </>
        )

        return (
          <li
            key={
              release.instanceId > 0
                ? `instance-${release.instanceId}`
                : `row-${index}-${releaseId}`
            }
          >
            {internal ? (
              <Link
                id={`crate-cover-${releaseId}`}
                href={href}
                scroll={false}
                prefetch={false}
                className={`group block ${focusRing}`}
                onClick={() => {
                  saveCollectionScroll(`crate-cover-${releaseId}`)
                  posthog.capture('collection_record_open', { release_id: releaseId })
                }}
              >
                {cover}
                {caption}
              </Link>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group block ${focusRing}`}
              >
                {cover}
                {caption}
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}
