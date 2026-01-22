import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Keegan | High-Vis Operations',
  description: 'GTM Engineer. I build go-to-market infrastructure from scratch. Query the system directly.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  )
}
