import Link from 'next/link'
import HouseFooter from '@/components/house/HouseFooter'
import HouseShell from '@/components/house/HouseShell'
import type { Metadata } from 'next'
import { DISCOGS_API_NOTICE } from '@/lib/discogs-notice'
import { houseMetadata } from '@/lib/metadata'
import styles from '@/components/house/editorial.module.css'

export const metadata: Metadata = houseMetadata('/legal', 'company + credits | lecturesfrom', 'built by hand. made to move. the work, principles, and people behind lecturesfrom LLC.')
const values = [
  ['learn the real constraints.', 'listen to the people doing the work. get specific about what they need, what they have tried, and what keeps breaking.'],
  ['make it useful in practice.', 'build something a person can understand, use, and keep running. stay close enough to see what happens after handoff.'],
  ['keep your own point of view.', 'care about the details. make room for experiments, music, and the things that give the work a voice.'],
]

export default function LegalPage() {
  return (
    <HouseShell>
      <article className={styles.page}>
        <header className={styles.companyHero}>
          <p className={styles.eyebrow}>lecturesfrom LLC · atlanta, georgia · founded 2025</p>
          <h1 className={styles.companyTitle}>built by hand.<br />made to move.</h1>
          <p className={styles.lede}>lecturesfrom is keegan moody’s independent house for sales systems, software, and records. a place to work on how a business grows and make things worth spending time with.</p>
        </header>
        <nav aria-label="on this page" className={styles.anchors}>
          <a href="#the-work">the work ↓</a><a href="#mission">mission + values ↓</a><a href="#shoutouts">shoutouts ↓</a><a href="#credits">company + credits ↓</a>
        </nav>
        <section id="the-work" className={`${styles.split} ${styles.companySection}`}>
          <h2 className={styles.sectionTitle}>get closer<br />to the work.</h2>
          <div className={styles.prose}>
            <p>when you believe in a product and i do too, i want to help it move. i get hands-on with the questions, product development, customer feedback, iteration, operations, and go-to-market.</p>
            <p>i work across product and business. that means following the problem wherever it leads: an unfamiliar market, a product decision, a customer’s frustration, or an operation that cannot keep up.</p>
            <p>the aim is to find what makes the product worth choosing, build on it, and turn that into momentum. the research, the product, and the way it reaches people have to inform each other.</p>
            <div className={styles.actions}><Link href="/keeganmoody33" className="house-button">see the work ↗</Link><a href="mailto:33@lecturesfrom.com" className="house-button house-button-secondary">start a conversation ↗</a></div>
          </div>
        </section>
        <section id="mission" className={`${styles.split} ${styles.companySection}`}>
          <h2 className={styles.eyebrow}>01 / mission</h2>
          <p className={styles.mission}>make the path from a good idea<br />to useful work shorter.</p>
        </section>
        <section className={`${styles.split} ${styles.companySection}`}>
          <h2 className={styles.eyebrow}>02 / how i work</h2>
          <div className={styles.prose}>{values.map(([title, body]) => <div key={title} className={styles.value}><h3>{title}</h3><p>{body}</p></div>)}</div>
        </section>
        <section className={`${styles.split} ${styles.companySection}`}>
          <h2 className={styles.eyebrow}>03 / fuel, growth, culture</h2>
          <div className={styles.prose}>
            <p>fuel is curiosity: an unfamiliar market, a record i cannot put down, a problem someone has learned to work around.</p>
            <p>growth is turning what we learn into a motion the team can repeat and improve.</p>
            <p>culture is the part people bring with them. the taste, care, and point of view should survive the process.</p>
          </div>
        </section>
        <section id="shoutouts" className={`${styles.split} ${styles.companySection}`}>
          <h2 className={styles.sectionTitle}>shoutouts.</h2>
          <div className={styles.prose}>
            <p>to the people and things that have helped along the way. thank you.</p>
            <dl className="w-full">
              <div className={styles.creditRow}><dt>the gtm community</dt><dd className={styles.creditNames}><a href="https://gtmcafe.com/" target="_blank" rel="noopener noreferrer">gtmcafe.com ↗</a><p>kellen casebeer</p><p>gtm engineering school</p><p>jordan crawford</p><p>and this entire community.</p></dd></div>
              <div className={styles.creditRow}><dt>my dad</dt><dd>an entrepreneur and a hustler. a man of the people. blue collar, hands-on, and creative.</dd></div>
            </dl>
            <p className={styles.mission}>hip hop.<br />god.</p>
          </div>
        </section>
        <section id="credits" className={`${styles.split} ${styles.companySection}`}>
          <h2 className={styles.sectionTitle}>company<br />+ credits.</h2>
          <div className={styles.prose}>
            <div className={styles.value}><h3>lecturesfrom LLC</h3><p>built and run by keegan moody in atlanta, georgia.<br />for project inquiries, site questions, or a correction:</p><a href="mailto:33@lecturesfrom.com" className="house-text-button mt-4">33@lecturesfrom.com ↗</a></div>
            <div className={styles.value}><h3>data sources</h3><p className="text-[var(--house-muted)]">{DISCOGS_API_NOTICE}</p><p className="mt-4">record pages identify the sources behind available credits and sample connections. missing information means it is not on file here.</p></div>
            <div className={styles.value}><h3>brand files</h3><p>the official mark, lockups, icons, and usage guidance.</p><Link href="/brand" className="house-text-button mt-4">open the brand kit ↗</Link></div>
          </div>
        </section>
      </article>
      <HouseFooter />
    </HouseShell>
  )
}
