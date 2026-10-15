import Link from 'next/link'
import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import type { Metadata } from 'next'
import { DISCOGS_API_NOTICE } from '@/lib/discogs-notice'
import { houseMetadata } from '@/lib/metadata'

export const metadata: Metadata = houseMetadata(
  '/legal',
  'company + credits | lecturesfrom',
  'company information, contact, and data-source credits for lecturesfrom LLC.'
)

export default function LegalPage() {
  return (
    <HouseShell>
      <HouseRail left="atl 33.70n" center="company + credits" right="llc" />
      <article className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
        <p className="house-meta">lecturesfrom LLC · atlanta, georgia · founded 2025</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.01em] sm:text-6xl">company + credits</h1>
        <p className="mt-6 font-mono text-base leading-relaxed">
          an independent house for revenue systems, creative tools, and physical products.
          built and run by keegan moody in atlanta.
        </p>
        <div className="mt-10 space-y-6 font-mono text-sm leading-relaxed">
          <h2 className="font-display text-2xl font-semibold">sales systems</h2>
          <p className="text-[var(--house-muted)]">
            research, outbound operations, integrations, and workflow automation.
            the work starts with how a team sells and what is getting in its way.
          </p>
          <h2 className="pt-4 font-display text-2xl font-semibold">publishing + products</h2>
          <p className="text-[var(--house-muted)]">
            software, records, printed work, and physical objects. the catalog holds the projects
            and their current state, with links to the work behind them.
          </p>
          <Link href="/catalog" className="house-text-button">explore the catalog</Link>
          <h2 className="pt-4 font-display text-2xl font-semibold">contact</h2>
          <p>for project inquiries, site questions, or a correction:</p>
          <a href="mailto:33@lecturesfrom.com" className="house-button house-button-secondary">email 33@lecturesfrom.com</a>
          <h2 className="pt-4 font-display text-2xl font-semibold">data sources</h2>
          <p className="text-[var(--house-muted)]">{DISCOGS_API_NOTICE}</p>
          <p className="text-[var(--house-muted)]">
            record pages identify the sources behind available credits and sample connections.
            missing information means it is not on file here.
          </p>
          <h2 className="pt-4 font-display text-2xl font-semibold">brand files</h2>
          <p className="text-[var(--house-muted)]">the brand kit includes the official mark, lockups, icons, and usage guidance.</p>
          <Link href="/brand" className="house-text-button">open the brand kit</Link>
        </div>
      </article>
      <HouseFooter />
    </HouseShell>
  )
}
