import Image from 'next/image'
import Link from 'next/link'
import styles from './editorial.module.css'

export default function ProductIntro({ product }: { product: 'punch2pen' | 'yadiggg' }) {
  const punch = product === 'punch2pen'
  return (
    <article>
      <div className={styles.breadcrumb}><Link href="/catalog" className="house-text-button">← back to catalog</Link><p className="house-meta">{punch ? 'lf-01 / software / in development' : 'lf-03 / hardware study / in development'}</p></div>
      <div className={`${styles.product} ${punch ? styles.punch : ''}`}>
        <div className={`${styles.productArt} ${punch ? styles.punchArt : ''}`}>
          <Image src={`/catalog/${product}/wordmark.svg`} width={punch ? 356 : 520} height={punch ? 50 : 274} alt={product} className={styles.productWordmark} priority />
          {punch && <Image src="/catalog/punch2pen/fist.svg" width={296} height={425} alt="Pencil held in a raised fist, punch2pen artwork." className={styles.productFist} />}
        </div>
        <div className={styles.intro}>
          <h1 className={styles.productTitle}>{punch ? <>the take,<br />written down.</> : <>know what’s<br />in the bin.</>}</h1>
          <p className={styles.lede}>{punch ? 'punch2pen transcribes vocals inside your daw. the words follow the session, so you can read a take while you listen and correct what the engine misheard.' : 'yadiggg is a pocket device concept for identifying records while you dig. the study explores the controls, screen, and feel of a tool you can use beside the crate.'}</p>
          {punch ? <><div className={styles.productNotes}><p>mac au + vst3</p><p>local transcription</p><p>development status and install notes on the project site</p></div><div className={styles.actions}><a href="https://punch2pen.com" target="_blank" rel="noopener noreferrer" className="house-button">visit punch2pen ↗</a><a href="https://github.com/keeganmoody33/punch2pen" target="_blank" rel="noopener noreferrer" className="house-button house-button-secondary">view source ↗</a></div></> : <><p className={styles.productNotes}>the hardware is in development. the model below is a form study, not a finished device.</p><div className={styles.actions}><a href="#device-study" className="house-button">explore the device study ↓</a></div></>}
        </div>
      </div>
      {punch && <div className={styles.heading}><p className="house-meta">built by lecturesfrom</p><Link href="/catalog/proper-respect" className="house-text-button">next in the catalog: proper-respect →</Link></div>}
    </article>
  )
}
