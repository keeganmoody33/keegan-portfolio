import type { Metadata } from 'next'
import HouseFooter from '@/components/house/HouseFooter'
import styles from '@/components/house/editorial.module.css'
import HouseShell from '@/components/house/HouseShell'
import FlipRoom from '@/components/house/FlipRoom'
import { FLIP_COPY } from '@/lib/flip/copy.ts'
import { FLIP_PATH } from '@/lib/flip/route.ts'
import { houseMetadata } from '@/lib/metadata'

export const metadata: Metadata = {
  ...houseMetadata(FLIP_PATH, 'doingflips | lecturesfrom', FLIP_COPY.lede),
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
      <div className={styles.page}>
        <header className={styles.companyHero}>
          <p className={styles.eyebrow}>doingflips / a song in. a flip back.</p>
          <h1 className={styles.title}>what’s stuck<br />in your head?</h1>
          <p className={styles.lede}>{FLIP_COPY.lede}</p>
        </header>
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
