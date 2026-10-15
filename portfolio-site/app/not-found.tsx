import Link from 'next/link'
import HouseFooter from '@/components/house/HouseFooter'
import HouseShell from '@/components/house/HouseShell'

export default function NotFound() {
  return (
    <HouseShell>
      <div className="px-6 pt-24 sm:px-10">
        <p className="house-meta">404</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.01em]">this page is missing</h1>
        <p className="mt-3 font-mono text-sm text-[var(--house-muted)]">
          the link may have moved. browse the catalog or head back to the house.
        </p>
        <p className="mt-8 font-mono text-sm">
          <Link href="/" className="house-button">
            back to home
          </Link>
        </p>
      </div>
      <HouseFooter />
    </HouseShell>
  )
}
