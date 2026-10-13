import Crate from '@/components/house/Crate'
import HouseBannerCard from '@/components/house/HouseBannerCard'
import HouseFooter from '@/components/house/HouseFooter'
import HouseShell from '@/components/house/HouseShell'
import { fetchFullCollection } from '@/lib/discogs'
import {
  HOUSE_BANNER_PREVIEW_PATH,
  isHouseBannerPrototypeEnabled,
} from '@/lib/house-banner'
import { houseMetadata } from '@/lib/metadata'
import { pickListedId } from '@/lib/shuffle'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const revalidate = 300

export const metadata: Metadata = {
  ...houseMetadata(
    HOUSE_BANNER_PREVIEW_PATH,
    'banner preview — lecturesfrom',
    'preview-only house banner prototype. not production.'
  ),
  robots: { index: false, follow: false },
}

/**
 * Preview-only home-banner prototype. 404s in production so `/` and
 * prod chrome stay unchanged even if this branch is merged.
 */
export default async function PreviewBannerPage() {
  if (!isHouseBannerPrototypeEnabled()) notFound()

  let releases: Awaited<ReturnType<typeof fetchFullCollection>>['releases'] = []
  try {
    const data = await fetchFullCollection()
    releases = data.releases
  } catch {
    releases = []
  }

  const initialId = pickListedId(releases)

  return (
    <HouseShell>
      <HouseBannerCard releases={releases} initialId={initialId} />
      <div className="mx-6 my-8 border-t border-[var(--house-line)] sm:mx-10" />
      <Crate />
      <HouseFooter />
    </HouseShell>
  )
}
