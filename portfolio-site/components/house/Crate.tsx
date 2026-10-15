import Link from 'next/link'
import SignalCut from '@/components/SignalCut'
import { crateLinkPrefetch, getCrateRows } from '@/lib/catalog'

function formatTag(row: ReturnType<typeof getCrateRows>[number]): string {
  if (row.kind === 'principal') return row.row.formatLabel
  return row.sleeve.format
}

function catno(row: ReturnType<typeof getCrateRows>[number]): string {
  if (row.kind === 'principal') return row.row.catno
  return row.sleeve.catno
}

function title(row: ReturnType<typeof getCrateRows>[number]): string {
  if (row.kind === 'principal') return row.row.title
  return row.sleeve.title
}

export default function Crate() {
  const rows = getCrateRows()

  return (
    <section id="catalog" className="px-6 sm:px-10" aria-label="catalog">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="house-meta">inside the house</h2>
        <span className="house-meta">open a sleeve</span>
      </div>
      <ol className="list-none p-0">
        {rows.map((row) => {
          const parked = row.kind === 'sleeve' && row.sleeve.status === 'parked'
          const className = `house-spine ${parked ? 'house-spine-parked' : ''}`
          const inner = (
            <>
              <span className="font-mono text-[11px] text-[var(--house-dim)]">{row.crateNo}</span>
              <span className="flex min-w-0 flex-col">
                <span className="house-spine-title font-display text-base font-semibold tracking-[-0.01em] sm:text-lg">{title(row)}</span>
                <span className="house-spine-description mt-2 font-mono text-[13px] leading-relaxed text-[var(--house-muted)]">
                  {row.kind === 'principal' ? 'the person behind the work. experience, questions, and contact.' : row.sleeve.aside}
                </span>
                <span className="mt-0.5 whitespace-nowrap font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--house-muted)] sm:hidden">
                  {formatTag(row)} / {catno(row)}
                </span>
              </span>
              <span className="house-spine-format hidden font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--house-muted)] sm:inline">
                {formatTag(row)}
              </span>
              <span className="house-spine-catno hidden whitespace-nowrap font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--house-dim)] md:inline">
                {catno(row)}
              </span>
              <span className="house-spine-status justify-self-end font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--house-muted)]">
                {row.kind === 'principal' ? 'about + contact' : row.label}<span aria-hidden="true"> ↗</span>
              </span>
            </>
          )

          if (row.kind === 'principal') {
            return (
              <li key={row.row.slug}>
                <SignalCut
                  href={row.href}
                  direction="toPerson"
                  className={className}
                  aria-label="keegan moody, experience and contact"
                >
                  {inner}
                </SignalCut>
              </li>
            )
          }

          return (
            <li key={row.sleeve.slug}>
              <Link
                href={row.href}
                prefetch={crateLinkPrefetch(row.href)}
                className={className}
              >
                {inner}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
