import HouseBanner from '@/components/house/HouseBanner'
import HouseRail from '@/components/house/HouseRail'
import {
  uniqueBannerReleases,
  type HouseBannerSource,
} from '@/lib/house-banner'

export default function HouseBannerCard({
  releases,
  initialId,
}: {
  releases: readonly HouseBannerSource[]
  initialId: number | null
}) {
  const tracks = uniqueBannerReleases(releases)

  return (
    <header className="pb-8">
      <HouseRail left="preview" center="banner" right="draft" />
      <div className="mt-16 px-6 sm:mt-24 sm:px-10">
        <HouseBanner releases={tracks} initialId={initialId} />
      </div>
      <div className="mt-10 max-w-xl space-y-1 px-6 font-mono text-sm leading-relaxed text-[var(--house-ink)] sm:px-10 sm:text-base">
        <p>not a studio. a garage.</p>
        <p>GTME &amp; revenue architecture.</p>
        <p>publishing house &amp; physical products.</p>
        <p>it is always deeper than it looks.</p>
      </div>
    </header>
  )
}
