import type { ReactNode } from 'react'

export default function HouseShell({ children }: { children: ReactNode }) {
  return <div className="house">{children}</div>
}
