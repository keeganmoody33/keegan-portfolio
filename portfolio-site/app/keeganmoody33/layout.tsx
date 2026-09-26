import type { Metadata } from 'next'
import { PERSON_DESCRIPTION, PERSON_TITLE } from '@/lib/site'

export const metadata: Metadata = {
  title: PERSON_TITLE,
  description: PERSON_DESCRIPTION,
}

export default function PersonLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
