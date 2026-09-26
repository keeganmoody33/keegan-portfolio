import type { ReactNode } from 'react'

export default function HouseShell({ children }: { children: ReactNode }) {
  return <main className="house">{children}</main>
}
