import type { Metadata } from 'next'
import { personMetadata } from '@/lib/metadata'

export const metadata: Metadata = personMetadata()

export default function PersonLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
