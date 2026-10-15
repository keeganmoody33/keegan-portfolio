'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/catalog', label: 'catalog' },
  { href: '/collection', label: 'records' },
  { href: '/flip', label: 'doingflips' },
  { href: '/brand', label: 'brand kit' },
  { href: '/keeganmoody33', label: 'keegan' },
]

export default function HouseNav() {
  const pathname = usePathname()

  return (
    <header className="house-navigation">
      <Link href="/" className="house-home-link" aria-current={pathname === '/' ? 'page' : undefined}>
        <Image src="/brand/kit/lockups/lf-lockup-horizontal-white-transparent.svg" width={238} height={66} alt="lecturesfrom home" className="house-nav-logo house-nav-logo-white" priority />
        <Image src="/brand/kit/lockups/lf-lockup-horizontal-ink-transparent.svg" width={238} height={66} alt="lecturesfrom home" className="house-nav-logo house-nav-logo-ink" />
      </Link>
      <nav aria-label="main navigation">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            prefetch={href === '/collection' ? false : undefined}
            aria-current={pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
