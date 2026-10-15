'use client'

import Link from 'next/link'
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
        lecturesfrom<span className="sr-only"> home</span>
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
