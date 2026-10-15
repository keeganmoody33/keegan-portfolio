import Link from 'next/link'
import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import ProductIntro from '@/components/house/ProductIntro'
import styles from '@/components/house/editorial.module.css'
import Sleeve from '@/components/house/Sleeve'
import { getSharedCatalogSlugParams, getSleeveBySlug } from '@/lib/catalog'
import { JsonLd, sleeveJsonLd } from '@/lib/jsonld'
import { houseMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const dynamicParams = false

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getSharedCatalogSlugParams()
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const sleeve = getSleeveBySlug(slug)
  if (!sleeve || sleeve.slug === 'collection') {
    return { title: 'not found | lecturesfrom' }
  }
  return houseMetadata(`/catalog/${sleeve.slug}`, `${sleeve.title} | lecturesfrom`, sleeve.aside)
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
      {slug === 'punch2pen' ? <div className={styles.page}><ProductIntro product="punch2pen" /></div> : <>
      <HouseRail left="atl 33.70n" center={sleeve.catno} right={String(sleeve.year)} />
      <div className="px-6 py-12 sm:px-10">
        <p className="house-meta mb-8">
          <Link href="/catalog" className="house-text-button">
            back to catalog
          </Link>
          <span className="mx-3">/</span>
          {sleeve.slug}
        </p>
        <Sleeve sleeve={sleeve} />
      </div>
      </>}
      <HouseFooter />
    </HouseShell>
  )
}
