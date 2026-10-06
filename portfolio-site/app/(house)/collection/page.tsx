import CollectionGrid from '@/components/house/CollectionGrid'
import DiscogsCredit from '@/components/house/DiscogsCredit'
import { getSleeveBySlug } from '@/lib/catalog'
import { DISCOGS_COLLECTION_PAGE, fetchFullCollection } from '@/lib/discogs'
import type { Metadata } from 'next'
import { houseMetadata } from '@/lib/metadata'

export const revalidate = 300

export const metadata: Metadata = houseMetadata(
  '/collection',
  'collection — lecturesfrom',
  'every release in the lecturesfrom discogs collection. not a curated window.'
)

const CRATE_UNAVAILABLE = 'crate temporarily unavailable'

function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build'
}

export default async function CollectionPage() {
  const collectionSleeve = getSleeveBySlug('collection')
  let releases: Awaited<ReturnType<typeof fetchFullCollection>>['releases'] = []
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
    <div className="px-6 py-12 sm:px-10">
      <p className="house-meta">crate · lf-00 · issued</p>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.01em] sm:text-6xl">
        collection
      </h1>
      {collectionSleeve && (
        <p className="mt-3 max-w-xl font-mono text-sm text-[var(--house-muted)]">
          {collectionSleeve.notes}
        </p>
      )}
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 font-mono text-[11px] tracking-[0.16em] text-[var(--house-dim)]">
        <span>{items === null ? 'count unavailable' : `${items} releases`}</span>
        <DiscogsCredit href={DISCOGS_COLLECTION_PAGE} inline />
      </p>

      {unavailable && (
        <p className="mt-8 font-mono text-sm text-[var(--house-dim)]">{CRATE_UNAVAILABLE}</p>
      )}

      <CollectionGrid releases={releases} />
      <div className="mt-8">
        <DiscogsCredit href={DISCOGS_COLLECTION_PAGE} />
      </div>
    </div>
  )
}
