import type { Metadata } from 'next'
import { PostHogProvider } from './providers'
import { rootHouseMetadata } from '@/lib/metadata'
import './globals.css'

export const metadata: Metadata = rootHouseMetadata()

const LOGO_PAUSE_BOOTSTRAP = `try{if(sessionStorage.getItem('lf-logo-paused')==='1'){document.documentElement.dataset.logoPaused='true'}var sync=function(){var b=document.querySelector('.lf-motion-switch');if(!b)return false;var p=document.documentElement.getAttribute('data-logo-paused')==='true';b.setAttribute('aria-checked',p?'false':'true');b.setAttribute('aria-label',p?'motion: off':'motion: on');return true};if(!sync()){var o=new MutationObserver(function(){if(sync())o.disconnect()});o.observe(document.documentElement,{childList:true,subtree:true})}}catch(e){}`

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
