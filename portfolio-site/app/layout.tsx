import type { Metadata } from 'next'
import { PostHogProvider } from './providers'
import { HOUSE_DESCRIPTION, HOUSE_TITLE } from '@/lib/site'
import './globals.css'

export const metadata: Metadata = {
  title: HOUSE_TITLE,
  description: HOUSE_DESCRIPTION,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  )
}
