import Link from 'next/link'
import type { Metadata } from 'next'
import HouseShell from '@/components/house/HouseShell'
import HouseFooter from '@/components/house/HouseFooter'
import LogoMotion from '@/components/house/LogoMotion'
import { houseMetadata } from '@/lib/metadata'
import styles from './motion.module.css'

export const metadata: Metadata = houseMetadata('/brand/motion', 'logo playground · lecturesfrom', 'Metal, heat, and light. Try different treatments of the lecturesfrom mark.')

export default function LogoPlaygroundPage() {
  return <HouseShell>
    <div className={styles.page}>
      <header className={styles.heading}>
        <div><p className={styles.eyebrow}>lecturesfrom / experiments / 001</p><h1>same mark.<br />different energy.</h1></div>
        <div className={styles.intro}><p>metal, heat, and light. a place to try things.</p><Link href="/brand" className="house-text-button">back to the brand kit <span aria-hidden="true">↗</span></Link></div>
      </header>
      <LogoMotion playground />
      <p className={styles.credit}>motion studies with <a href="https://shaders.paper.design/" target="_blank" rel="noreferrer">paper shaders ↗</a></p>
    </div>
    <HouseFooter />
  </HouseShell>
}
