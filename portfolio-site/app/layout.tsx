import type { Metadata } from 'next'
import { PostHogProvider } from './providers'
import { rootHouseMetadata } from '@/lib/metadata'
import './globals.css'

export const metadata: Metadata = rootHouseMetadata()

const LOGO_PAUSE_BOOTSTRAP = `try { if (sessionStorage.getItem('lf-logo-paused') === '1') document.documentElement.dataset.logoPaused = 'true'; } catch (e) {}`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOGO_PAUSE_BOOTSTRAP }} />
      </head>
      <body className="antialiased min-h-screen">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  )
}
