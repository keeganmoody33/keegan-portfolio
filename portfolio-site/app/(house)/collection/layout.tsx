import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import type { ReactNode } from 'react'

export default function CollectionLayout({
  children,
  detail,
}: {
  children: ReactNode
  detail: ReactNode
}) {
  return (
    <HouseShell>
      <HouseRail left="atl 33.70n" center="lf-00" right="live" />
      <div data-collection-root>{children}</div>
      {detail}
      <HouseFooter />
    </HouseShell>
  )
}
