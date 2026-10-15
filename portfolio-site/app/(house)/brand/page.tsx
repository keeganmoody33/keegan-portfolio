import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import { houseMetadata } from '@/lib/metadata'
import styles from './brand.module.css'

export const metadata: Metadata = houseMetadata(
  '/brand',
  'brand kit · lecturesfrom',
  'Download the lecturesfrom logos, name lockups, profile icons and print files. Choose a file or get the full brand kit.'
)

const SECTIONS = [
  ['logos', 'logos'],
  ['lockups', 'mark + name'],
  ['icons', 'profiles + icons'],
  ['print', 'print files'],
  ['guidelines', 'usage + colors'],
  ['links', 'links + file index'],
] as const

type Download = { file: string; label: string; detail: string; format: string }

const ICONS: Download[] = [
  { file: 'kit/lf-avatar-light-400.png', label: 'profile image on white', detail: '400 × 400px, ready for a circle crop', format: 'png' },
  { file: 'kit/lf-avatar-dark-400.png', label: 'profile image on black', detail: '400 × 400px, ready for a circle crop', format: 'png' },
  { file: 'kit/lf-avatar-light-1024.png', label: 'large profile image on white', detail: '1024 × 1024px', format: 'png' },
  { file: 'kit/lf-avatar-dark-1024.png', label: 'large profile image on black', detail: '1024 × 1024px', format: 'png' },
  { file: 'kit/lf-app-icon-light-1024.png', label: 'app icon on white', detail: '1024 × 1024px, full background', format: 'png' },
  { file: 'kit/lf-app-icon-dark-1024.png', label: 'app icon on black', detail: '1024 × 1024px, full background', format: 'png' },
  { file: 'kit/lf-maskable-light-512.png', label: 'adaptive app icon on white', detail: '512 × 512px, safe area for device masks', format: 'png' },
  { file: 'kit/lf-maskable-dark-512.png', label: 'adaptive app icon on black', detail: '512 × 512px, safe area for device masks', format: 'png' },
  { file: 'kit/lf-favicon-plate.svg', label: 'browser icon', detail: 'white plate, visible on dark tabs', format: 'svg' },
  { file: 'kit/lf-slack-128.png', label: 'slack emoji', detail: '128 × 128px, white plate', format: 'png' },
  { file: 'kit/lf-spin.gif', label: 'animated slack emoji', detail: 'the orbit in motion', format: 'gif' },
]

const COLORS = [
  { name: 'mark ink', hex: '#20262B', use: 'the logo on light backgrounds' },
  { name: 'house black', hex: '#0A0A0A', use: 'the dark page background' },
  { name: 'house white', hex: '#ECECEC', use: 'text on dark backgrounds' },
  { name: 'house orange', hex: '#E23D00', use: 'small accents, under 2% of a layout' },
  { name: 'lcd', hex: '#AFC875', use: 'readouts, with black text' },
]

function DownloadList({ files }: { files: Download[] }) {
  return (
    <ul className={styles.downloads}>
      {files.map(({ file, label, detail, format }) => (
        <li key={file}>
          <a href={`/brand/${file}`} download className={styles.fileLink}>
            <span><span className={styles.fileName}>{label}</span><span className={styles.fileDetail}>{detail}</span></span>
            <span className={styles.fileFormat}>download {format}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function DownloadLink({ file, children, label }: { file: string; children: ReactNode; label: string }) {
  return <a href={`/brand/${file}`} download aria-label={label} className={styles.textLink}>{children}</a>
}

export default function BrandPage() {
  return (
    <HouseShell>
      <HouseRail left="atl 33.70n" center="brand kit" right="lecturesfrom" />
      <article className={styles.page} id="brand-top">
        <nav className={styles.topNav} aria-label="brand kit navigation">
          <Link href="/" className={styles.textLink}>back to lecturesfrom</Link>
          <a href="mailto:33@lecturesfrom.com" className={styles.textLink}>ask about the kit</a>
        </nav>

        <header className={styles.hero}>
          <div>
            <h1>brand kit</h1>
            <p className={styles.lede}>the lecturesfrom files, ready to use. logos for a page, icons for a profile, and vectors for print.</p>
            <div className={styles.actions}>
              <a href="/brand/kit/lf-brand-kit.zip" download className={styles.primary}>download the full kit <span aria-hidden="true">↓</span></a>
              <a href="#logos" className={styles.secondary}>choose individual files</a>
            </div>
            <p className={styles.support}>one zip with logos, mark + name, icons, print files and color tokens.</p>
          </div>
          <div className={styles.heroMark}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-white.svg" width={192} height={192} alt="lecturesfrom mark" />
            <span>the official mark</span>
          </div>
        </header>

        <div className={styles.layout}>
          <aside className={styles.index}>
            <nav aria-label="on this page">
              <p>in the kit</p>
              <ul>{SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ul>
              <a href="#brand-top" className={styles.backTop}>back to top ↑</a>
            </nav>
          </aside>

          <div className={styles.content}>
            <section id="logos" aria-labelledby="logos-heading">
              <h2 id="logos-heading">logos</h2>
              <p>use the mark on its own when the lecturesfrom name is already nearby. choose the version that stays clear against your background.</p>
              <p className={styles.support}>svg scales to any size. png works in slides, email signatures and most everyday tools. both have transparent backgrounds.</p>
              <div className={styles.pair}>
                {(['ink', 'white'] as const).map((mode) => {
                  const ink = mode === 'ink'
                  const name = ink ? 'dark logo' : 'white logo'
                  const file = ink ? 'logo' : 'logo-white'
                  return <div key={mode}>
                    <figure className={ink ? styles.lightPreview : styles.darkPreview}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/brand/${file}.svg`} alt={name} width={128} height={128} />
                    </figure>
                    <h3>{ink ? 'for light backgrounds' : 'for dark backgrounds'}</h3>
                    <div className={styles.formats}>
                      <DownloadLink file={`${file}.svg`} label={`download svg, ${name}`}>download svg</DownloadLink>
                      <DownloadLink file={`${file}-1024.png`} label={`download png, ${name}, 1024 pixels`}>download png</DownloadLink>
                    </div>
                    <DownloadLink file={`${file}-512.png`} label={`512px png for email, ${name}`}>512px png for email</DownloadLink>
                  </div>
                })}
              </div>
            </section>

            <section id="lockups" aria-labelledby="lockups-heading">
              <h2 id="lockups-heading">mark + name</h2>
              <p>use these when you need the full name alongside the mark. the lettering is included in the file, so you do not need to install a font.</p>
              <div className={styles.lockupPreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/kit/lockups/lf-lockup-horizontal-ink.svg" alt="lecturesfrom, horizontal mark and name" width={360} height={100} />
              </div>
              <DownloadList files={[
                { file: 'kit/lockups/lf-lockup-horizontal-ink-transparent.svg', label: 'horizontal, dark ink', detail: 'for a light background', format: 'svg' },
                { file: 'kit/lockups/lf-lockup-horizontal-white-transparent.svg', label: 'horizontal, white', detail: 'for a dark background', format: 'svg' },
                { file: 'kit/lockups/lf-lockup-vertical-ink-transparent.svg', label: 'stacked, dark ink', detail: 'for a narrow space on a light background', format: 'svg' },
                { file: 'kit/lockups/lf-lockup-vertical-white-transparent.svg', label: 'stacked, white', detail: 'for a narrow space on a dark background', format: 'svg' },
              ]} />
              <details className={styles.more}>
                <summary>need a png instead?</summary>
                <DownloadList files={(['horizontal', 'vertical'] as const).flatMap((direction) => (['ink', 'white'] as const).map((mode) => ({
                  file: `kit/lockups/lf-lockup-${direction}-${mode}-transparent.png`,
                  label: `${direction === 'vertical' ? 'stacked' : 'horizontal'}, ${mode === 'ink' ? 'dark ink' : 'white'}`,
                  detail: 'transparent background', format: 'png',
                })))} />
              </details>
              <p className={styles.support}>all four versions are transparent. versions with solid backgrounds are also in the full kit.</p>
            </section>

            <section id="icons" aria-labelledby="icons-heading">
              <h2 id="icons-heading">profiles + icons</h2>
              <p>start with a 400px profile image for social accounts. use the larger files for apps, or the small plate for a browser tab or slack.</p>
              <div className={styles.iconPreviews}>
                {[
                  ['lf-avatar-light-400.png', 'profile on white'],
                  ['lf-avatar-dark-400.png', 'profile on black'],
                  ['lf-app-icon-dark-1024.png', 'app icon'],
                  ['lf-slack-128.png', 'slack emoji'],
                ].map(([file, label]) => <figure key={file}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/brand/kit/${file}`} alt="" width={96} height={96} loading="lazy" />
                  <figcaption>{label}</figcaption>
                </figure>)}
              </div>
              <DownloadList files={ICONS} />
            </section>

            <section id="print" aria-labelledby="print-heading">
              <h2 id="print-heading">print files</h2>
              <p>send the vector pdf to your printer. use the eps if their workflow calls for it.</p>
              <DownloadList files={[
                { file: 'kit/lf-mark-ink.pdf', label: 'dark mark for print', detail: 'vector pdf', format: 'pdf' },
                { file: 'kit/lf-mark-ink.eps', label: 'dark mark for print', detail: 'eps with live strokes', format: 'eps' },
              ]} />
              <p className={styles.support}>the eps strokes are not outlined. pantone matches are unproofed. confirm the final color and file requirements with your printer before production.</p>
            </section>

            <section id="guidelines" aria-labelledby="guidelines-heading">
              <h2 id="guidelines-heading">use it as it is</h2>
              <div className={styles.rules}>
                <div><h3>one word. lowercase.</h3><p>write lecturesfrom. use lecturesfrom LLC only in legal lines.</p></div>
                <div><h3>give the mark room</h3><p>leave at least a third of the mark’s width clear on every side. keep the full mark at 24px or larger on screen.</p></div>
                <div><h3>keep the shape</h3><p>use the supplied files. do not stretch, rotate, recolor, outline or add effects. keep the inside of the circle clear.</p></div>
              </div>
              <h3 className={styles.subheading}>house colors</h3>
              <p>use these for lecturesfrom materials. product brands keep their own colors.</p>
              <dl className={styles.colors}>
                {COLORS.map(({ name, hex, use }) => <div key={hex}>
                  <dt><span className={styles.swatch} style={{ backgroundColor: hex }} aria-hidden="true" />{name}</dt>
                  <dd><code>{hex}</code><span>{use}</span></dd>
                </div>)}
              </dl>
              <DownloadLink file="kit/house.css" label="download color tokens as css">download color tokens as css</DownloadLink>
              <h3 className={styles.subheading}>built by lecturesfrom</h3>
              <p>products like punch2pen keep their own name, colors and type. the endorsement goes on the back: a footer, about panel, installer or sleeve back.</p>
              <p className={styles.endorsement}>built by lecturesfrom</p>
              <p className={styles.support}>small caps mono, one color, in the product’s own ink. keep it out of the product logo and off the hero. never use house orange for the endorsement.</p>
            </section>

            <section id="links" aria-labelledby="links-heading">
              <h2 id="links-heading">links + file index</h2>
              <p>embedding the mark on a website? these links keep the same address when the files are updated.</p>
              <ul className={styles.stableLinks}>
                <li><a href="/brand/logo.svg">www.lecturesfrom.com/brand/logo.svg</a></li>
                <li><a href="/brand/logo-white.svg">www.lecturesfrom.com/brand/logo-white.svg</a></li>
                <li><a href="/brand/logo-1024.png">www.lecturesfrom.com/brand/logo-1024.png</a></li>
              </ul>
              <p>need a version that stays fixed? the file index lists sizes, hashes and links to saved versions.</p>
              <DownloadLink file="manifest.json" label="download the file index as json">download the file index as json</DownloadLink>
            </section>

            <div className={styles.finish}>
              <h2>take it with you</h2>
              <p>the full kit keeps the files together. if you need a format that is missing, ask.</p>
              <div className={styles.actions}>
                <a href="/brand/kit/lf-brand-kit.zip" download className={styles.primary}>download the full kit <span aria-hidden="true">↓</span></a>
                <a href="mailto:33@lecturesfrom.com" className={styles.textLink}>ask about a file</a>
              </div>
              <p className={styles.support}>© lecturesfrom LLC. the mark may be used to refer to lecturesfrom.</p>
            </div>
          </div>
        </div>
      </article>
      <HouseFooter />
    </HouseShell>
  )
}
