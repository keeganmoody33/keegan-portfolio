import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import IssuePlate from '@/components/house/IssuePlate'
import { getSleeveBySlug } from '@/lib/catalog'
import { fetchFullCollection } from '@/lib/discogs'
import type { Metadata } from 'next'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'collection — lecturesfrom',
  description: 'every release in the lecturesfrom discogs collection. not a curated window.',
}

export default async function CollectionPage() {
  const collectionSleeve = getSleeveBySlug('collection')
  let errorMessage: string | null = null
  let releases: Awaited<ReturnType<typeof fetchFullCollection>>['releases'] = []
  let items = 0

  try {
    const data = await fetchFullCollection()
    releases = data.releases
    items = data.pagination.items
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'collection unavailable'
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
        <p className="mt-2 font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--house-dim)]">
          {items} releases
        </p>

        {errorMessage && (
          <p className="mt-8 font-mono text-sm text-[var(--house-orange)]">{errorMessage}</p>
        )}

        <ul className="mt-10 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {releases.map((release) => (
            <li key={release.discogsUrl}>
              <a
                href={release.discogsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                {release.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={release.cover}
                    alt={`${release.artist} — ${release.title}`}
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
          ))}
        </ul>
      </div>
      <HouseFooter />
    </HouseShell>
  )
}
