import Link from 'next/link'
import dynamic from 'next/dynamic'
import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import Sleeve from '@/components/house/Sleeve'
import { getSleeveBySlug } from '@/lib/catalog'
import { JsonLd, sleeveJsonLd } from '@/lib/jsonld'
import { houseMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const SleeveViewer = dynamic(() => import('@/components/house/SleeveViewer'))

const sleeve = getSleeveBySlug('yadiggg')

export const metadata: Metadata = sleeve
  ? houseMetadata(`/catalog/${sleeve.slug}`, `${sleeve.title} — lecturesfrom`, sleeve.aside)
  : { title: 'not found — lecturesfrom' }

export default function YadigggSleevePage() {
  if (!sleeve) {
    notFound()
  }

  const jsonLd = sleeveJsonLd(sleeve.slug)
  const study = sleeve.viewer ? (
    <SleeveViewer
      viewer={sleeve.viewer}
      posterSrc={sleeve.viewer.poster ?? sleeve.cover ?? ''}
      sleeveTitle={sleeve.title}
    />
  ) : null

  return (
    <HouseShell>
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
      <HouseRail left="atl 33.70n" center={sleeve.catno} right={String(sleeve.year)} />
      <div className="px-6 py-12 sm:px-10">
        <p className="house-meta mb-8">
          <Link href="/catalog" className="hover:text-[var(--house-orange)]">
            catalog
          </Link>
          <span className="mx-3">/</span>
          {sleeve.slug}
        </p>
        <Sleeve sleeve={sleeve} study={study} />
      </div>
      <HouseFooter />
    </HouseShell>
  )
}
