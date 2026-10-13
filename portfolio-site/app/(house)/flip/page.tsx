import type { Metadata } from 'next'
import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import FlipRoom from '@/components/house/FlipRoom'
import { FLIP_COPY } from '@/lib/flip/copy.ts'
import { FLIP_PATH } from '@/lib/flip/route.ts'
import { houseMetadata } from '@/lib/metadata'

export const metadata: Metadata = {
  ...houseMetadata(FLIP_PATH, 'doingflips — lecturesfrom', FLIP_COPY.lede),
  robots: { index: false, follow: false },
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function FlipPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <HouseShell>
      <HouseRail left="atl 33.70n" center={FLIP_COPY.nav} right="lf" />
      <div className="px-6 pb-16 pt-16 sm:px-10">
        <h1 className="overflow-visible font-display text-4xl font-semibold tracking-[-0.01em] sm:text-6xl">
          <span>doing</span>
          <span className="flip-h1">{FLIP_COPY.h1Mark}</span>
          <span>s</span>
        </h1>
        <p className="mt-3 max-w-xl font-mono text-sm text-[var(--house-muted)]">{FLIP_COPY.lede}</p>
        <FlipRoom
          track={first(params.track)}
          title={first(params.title)}
          artist={first(params.artist)}
          stub={first(params.stub)}
        />
      </div>
      <HouseFooter />
    </HouseShell>
  )
}
