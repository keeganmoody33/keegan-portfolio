import Link from 'next/link'

export default function HouseFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--house-line)] px-6 py-8 sm:px-10">
      <p className="house-meta">lecturesfrom LLC · Atlanta, Georgia</p>
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
        <Link href="/collection" className="hover:text-[var(--house-orange)]">
          collection
        </Link>
        <Link href="/legal" className="hover:text-[var(--house-orange)]">
          legal
        </Link>
      </nav>
    </footer>
  )
}
