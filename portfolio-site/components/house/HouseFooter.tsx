import Link from 'next/link'
import RequestTally from '@/components/house/RequestTally'
import { FLIP_COPY } from '@/lib/flip/copy.ts'
import { FLIP_PATH } from '@/lib/flip/route.ts'

/**
 * Shared house footer. `MotionSwitch` stays in the repo (preference
 * CSS, head bootstrap, sessionStorage) but is not rendered while the
 * wordmark o is a static mark and nothing on this footer needs a
 * pause control. Discogs API non-affiliation is on /legal, not here.
 */
export default function HouseFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--house-line)] px-6 py-8 sm:px-10">
      <p className="font-mono text-[11px] tracking-wide text-[var(--house-muted)]">
        lecturesfrom LLC · Atlanta, Georgia
      </p>
      <p className="mt-2 font-mono text-[11px] tracking-wide text-[var(--house-muted)]">
        have a project in mind? <a href="mailto:33@lecturesfrom.com" className="inline-flex min-h-11 items-center text-[var(--house-ink)] underline underline-offset-4">email 33@lecturesfrom.com</a>
      </p>
      <nav aria-label="footer" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[13px] text-[var(--house-ink)] [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:underline [&_a]:underline-offset-4 [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-[var(--house-ink)]">
        <Link href="/" className="hover:text-[var(--house-orange)]">
          home
        </Link>
        <Link href="/catalog" className="hover:text-[var(--house-orange)]">
          catalog
        </Link>
        <Link href="/collection" prefetch={false} className="hover:text-[var(--house-orange)]">
          records
        </Link>
        <Link href={FLIP_PATH} className="hover:text-[var(--house-orange)]">
          {FLIP_COPY.nav}
        </Link>
        <Link href="/brand" className="hover:text-[var(--house-orange)]">
          brand kit
        </Link>
        <Link href="/keeganmoody33" className="hover:text-[var(--house-orange)]">keegan + contact</Link>
        <Link href="/legal" className="hover:text-[var(--house-orange)]">
          legal
        </Link>
      </nav>
      <RequestTally />
    </footer>
  )
}
