import Crate from '@/components/house/Crate'
import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'catalog — lecturesfrom',
  description: 'crate permalink. sleeves issued by lecturesfrom.',
}

export default function CatalogPage() {
  return (
    <HouseShell>
      <HouseRail left="atl 33.70n" center="catalog" right="lf" />
      <div className="px-6 pb-4 pt-16 sm:px-10">
        <h1 className="font-space text-4xl tracking-tight sm:text-6xl">catalog</h1>
        <p className="mt-3 max-w-xl font-mono text-sm text-[var(--house-muted)]">
          a catalog item is a record sleeve that holds artifacts. front = cover. back = liner notes.
          contents = numbered tracks.
        </p>
      </div>
      <Crate />
      <HouseFooter />
    </HouseShell>
  )
}
