import Link from 'next/link'
import HouseFooter from '@/components/house/HouseFooter'
import HouseShell from '@/components/house/HouseShell'

export default function NotFound() {
  return (
    <HouseShell>
      <div className="px-6 pt-24 sm:px-10">
        <p className="house-meta">404</p>
        <h1 className="mt-4 font-space text-4xl tracking-tight">not found</h1>
        <p className="mt-3 font-mono text-sm text-[var(--house-muted)]">
          no sleeve at this slug.
        </p>
        <p className="mt-8 font-mono text-sm">
          <Link href="/" className="hover:text-[var(--house-orange)]">
            lecturesfrom
          </Link>
        </p>
      </div>
      <HouseFooter />
    </HouseShell>
  )
}
