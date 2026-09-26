import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import IssuePlate from '@/components/house/IssuePlate'
import { getSleeveBySlug } from '@/lib/catalog'
import { fetchFullCollection, type DiscogsRelease } from '@/lib/discogs'
import type { Metadata } from 'next'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'collection — lecturesfrom',
  description: 'every release in the lecturesfrom discogs collection. not a curated window.',
}

const CRATE_UNAVAILABLE = 'crate temporarily unavailable'

function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build'
}

export default async function CollectionPage() {
  const collectionSleeve = getSleeveBySlug('collection')
  let releases: DiscogsRelease[] = []
  let items: number | null = null
  let unavailable = false

  try {
    const data = await fetchFullCollection()
    releases = data.releases
    items = data.pagination.items
  } catch (error) {
    // Catch only during `next build` so a down Discogs does not fail the build.
    // At runtime / ISR, rethrow so Next keeps serving the last good HTML
    // instead of caching this fallback for 300s.
    if (!isProductionBuild()) {
      throw error
    }
    unavailable = true
  }

  return (
    <HouseShell>
      <HouseRail left="atl 33.70n" center="lf-00" right="live" />
      <div className="px-6 py-12 sm:px-10">
        <p className="house-meta">crate · lf-00 · issued</p>
        <h1 className="mt-4 font-space text-4xl tracking-tight sm:text-6xl">collection</h1>
        {collectionSleeve && (
          <p className="mt-3 max-w-xl font-mono text-sm text-[var(--house-muted)]">
            {collectionSleeve.notes}
          </p>
        )}
        <p className="mt-2 font-mono text-[11px] tracking-[0.16em] text-[var(--house-dim)]">
          {items === null ? 'count unavailable' : `${items} releases`}
        </p>

        {unavailable && (
          <p className="mt-8 font-mono text-sm text-[var(--house-orange)]">{CRATE_UNAVAILABLE}</p>
        )}

        <ul className="mt-10 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {releases.map((release) => {
            const src = release.thumbnail || release.cover
            return (
              <li key={release.discogsUrl}>
                <a
                  href={release.discogsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={`${release.artist} — ${release.title}`}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full border border-[var(--house-line)] object-cover"
                    />
                  ) : collectionSleeve ? (
                    <IssuePlate sleeve={collectionSleeve} />
                  ) : null}
                  <p className="mt-2 font-mono text-[11px] leading-snug text-[var(--house-ink)] group-hover:text-[var(--house-orange)]">
                    {release.artist}
                  </p>
                  <p className="font-mono text-[11px] text-[var(--house-muted)]">{release.title}</p>
                  <p className="house-meta mt-1">{release.year || '—'}</p>
                </a>
              </li>
            )
          })}
        </ul>
      </div>
      <HouseFooter />
    </HouseShell>
  )
}
