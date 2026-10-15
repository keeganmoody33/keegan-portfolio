import Crate from '@/components/house/Crate'
import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import type { Metadata } from 'next'
import { houseMetadata } from '@/lib/metadata'

export const metadata: Metadata = houseMetadata(
  '/catalog',
  'catalog | lecturesfrom',
  'software, hardware, and records from lecturesfrom. explore each project and the work behind it.'
)

export default function CatalogPage() {
  return (
    <HouseShell>
      <HouseRail left="atl 33.70n" center="catalog" right="lf" />
      <div className="px-6 pb-4 pt-16 sm:px-10">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.01em] sm:text-6xl">catalog</h1>
        <p className="mt-3 max-w-xl font-mono text-sm text-[var(--house-muted)]">
          software for the booth. a place for the tools you stand behind. a device for the record bin.
          open a sleeve to see what each project does, where it stands, and where to go next.
        </p>
      </div>
      <Crate />
      <HouseFooter />
    </HouseShell>
  )
}
