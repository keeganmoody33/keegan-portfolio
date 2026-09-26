import Link from 'next/link'
import SignalCut from '@/components/SignalCut'
import { getCrateRows } from '@/lib/catalog'

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
    <section className="px-6 sm:px-10" aria-label="crate">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="house-meta">crate</h2>
        <span className="house-meta">spines</span>
      </div>
      <ol className="list-none p-0">
        {rows.map((row) => {
          const parked = row.kind === 'sleeve' && row.sleeve.status === 'parked'
          const className = `house-spine ${parked ? 'house-spine-parked' : ''}`
          const inner = (
            <>
              <span className="font-mono text-[11px] text-[var(--house-dim)]">{row.crateNo}</span>
              <span className="house-spine-title font-space text-base sm:text-lg">{title(row)}</span>
              <span className="hidden font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--house-muted)] sm:inline">
                {formatTag(row)}
              </span>
              <span className="hidden font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--house-dim)] md:inline">
                {catno(row)}
              </span>
              <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--house-muted)]">
                {row.label}
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
                  aria-label="keegan moody, principal channel"
                >
                  {inner}
                </SignalCut>
              </li>
            )
          }

          return (
            <li key={row.sleeve.slug}>
              <Link href={row.href} className={className}>
                {inner}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
