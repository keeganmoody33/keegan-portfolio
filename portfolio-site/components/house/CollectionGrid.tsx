'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import CrateCover from '@/components/house/CrateCover'
import { restoreCollectionScroll, saveCollectionScroll } from '@/components/house/RecordDetail'
import {
  displayCoverUrl,
  discogsGridHotlink,
  parseDiscogsImageDimensions,
  type CoverManifest,
} from '@/lib/crate/cover-display'
import type { DiscogsRelease } from '@/lib/discogs'
import { posthog } from '@/lib/posthog-client'

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)]'

export default function CollectionGrid({
  releases,
  covers = {},
}: {
  releases: DiscogsRelease[]
  covers?: Record<string, CoverManifest>
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
        const stored = covers[String(releaseId)]
        const fallback = discogsGridHotlink(release.thumbnail, release.cover)
        const src = displayCoverUrl(stored, fallback)
        const dims = stored
          ? { width: stored.width, height: stored.height }
          : parseDiscogsImageDimensions(src)
        const eager = index < 10
        const href = releaseId > 0 ? `/collection/${releaseId}` : release.discogsUrl
        const internal = releaseId > 0
        const year = release.year > 0 ? String(release.year) : null

        const cover = (
          <CrateCover
            kind="grid"
            src={src}
            width={dims?.width}
            height={dims?.height}
            alt=""
            artist={release.artist}
            title={release.title}
            eager={eager}
            priority={index === 0}
          />
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
