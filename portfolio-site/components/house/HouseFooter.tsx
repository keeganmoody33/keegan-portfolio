import Link from 'next/link'
import RequestTally from '@/components/house/RequestTally'

/**
 * Shared house footer. `MotionSwitch` stays in the repo (preference
 * CSS, head bootstrap, sessionStorage) but is not rendered while the
 * wordmark o is a static mark and nothing on this footer needs a
 * pause control.
 */
export default function HouseFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--house-line)] px-6 py-8 sm:px-10">
      <p className="font-mono text-[11px] tracking-wide text-[var(--house-muted)]">
        lecturesfrom LLC · Atlanta, Georgia
      </p>
      <p className="mt-2 font-mono text-[11px] tracking-wide text-[var(--house-muted)]">
        we think through every thing we ship.
      </p>
      <nav className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--house-dim)]">
        <Link href="/" className="hover:text-[var(--house-orange)]">
          root
        </Link>
        <Link href="/catalog" className="hover:text-[var(--house-orange)]">
          catalog
        </Link>
        <Link href="/collection" prefetch={false} className="hover:text-[var(--house-orange)]">
          collection
        </Link>
        <Link href="/legal" className="hover:text-[var(--house-orange)]">
          legal
        </Link>
      </nav>
      <RequestTally />
    </footer>
  )
}
