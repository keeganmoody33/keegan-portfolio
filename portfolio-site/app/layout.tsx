import type { Metadata } from 'next'
import { PostHogProvider } from './providers'
import { rootHouseMetadata } from '@/lib/metadata'
import './globals.css'

export const metadata: Metadata = rootHouseMetadata()

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
