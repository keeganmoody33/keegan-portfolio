import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Keegan Moody | GTM Engineer',
  description: 'GTM Engineer specializing in building go-to-market infrastructure from scratch at early-stage startups.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
