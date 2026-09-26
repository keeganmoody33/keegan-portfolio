import Link from 'next/link'
import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import Sleeve from '@/components/house/Sleeve'
import { getCatalogPageSleeves, getSleeveBySlug } from '@/lib/catalog'
import { JsonLd, sleeveJsonLd } from '@/lib/jsonld'
import { houseMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const dynamicParams = false

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getCatalogPageSleeves().map((sleeve) => ({ slug: sleeve.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const sleeve = getSleeveBySlug(slug)
  if (!sleeve || sleeve.slug === 'collection') {
    return { title: 'not found — lecturesfrom' }
  }
  return houseMetadata(`/catalog/${sleeve.slug}`, `${sleeve.title} — lecturesfrom`, sleeve.aside)
}

export default async function SleevePage({ params }: PageProps) {
  const { slug } = await params
  const sleeve = getSleeveBySlug(slug)
  if (!sleeve || sleeve.slug === 'collection') {
    notFound()
  }

  const jsonLd = sleeveJsonLd(sleeve.slug)

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
        <Sleeve sleeve={sleeve} />
      </div>
      <HouseFooter />
    </HouseShell>
  )
}
