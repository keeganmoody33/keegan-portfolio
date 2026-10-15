import Link from 'next/link'
import dynamic from 'next/dynamic'
import HouseFooter from '@/components/house/HouseFooter'
import ProductIntro from '@/components/house/ProductIntro'
import styles from '@/components/house/editorial.module.css'
import HouseShell from '@/components/house/HouseShell'
import { getSleeveBySlug } from '@/lib/catalog'
import { JsonLd, sleeveJsonLd } from '@/lib/jsonld'
import { houseMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const SleeveViewer = dynamic(() => import('@/components/house/SleeveViewer'))

const sleeve = getSleeveBySlug('yadiggg')

export const metadata: Metadata = sleeve
  ? houseMetadata(`/catalog/${sleeve.slug}`, `${sleeve.title} | lecturesfrom`, sleeve.aside)
  : { title: 'not found | lecturesfrom' }

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
      <div className={styles.page}>
        <ProductIntro product="yadiggg" />
        <section id="device-study" aria-labelledby="device-study-title">
          <div className={styles.heading}><h2 id="device-study-title" className={styles.sectionTitle}>the device study</h2><p className="house-meta">3d study / reference photo</p></div>
          {study}
          <p className="mt-6 font-mono text-sm leading-relaxed text-[var(--house-muted)]">{sleeve.notes}</p>
          <a href="https://github.com/keeganmoody33/YADIGGG" target="_blank" rel="noopener noreferrer" className="house-text-button mt-4">view yadiggg on github ↗</a>
        </section>
        <Link href="/catalog" className="house-text-button mt-8">back to catalog</Link>
      </div>
      <HouseFooter />
    </HouseShell>
  )
}
