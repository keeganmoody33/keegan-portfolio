import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { JamMetadata } from './jam-metadata'
import { PostHogProvider } from './providers'

export const metadata: Metadata = {
  title: 'Keegan Moody | lecturesfrom',
  description: 'GTM Engineer. I build go-to-market infrastructure from scratch. Query the system directly.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="jam:team" content="1fa5e16b-202b-4eae-8b03-dbac1fcc4157" />
      </head>
      <body className="antialiased min-h-screen">
        <Script
          src="https://js.jam.dev/recorder.js"
          type="module"
          strategy="beforeInteractive"
        />
        <Script
          src="https://js.jam.dev/capture.js"
          type="module"
          strategy="beforeInteractive"
        />
        <JamMetadata />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  )
}
