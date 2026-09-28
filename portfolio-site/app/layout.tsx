import type { Metadata } from 'next'
import Script from 'next/script'
import { PostHogProvider } from './providers'
import { rootHouseMetadata } from '@/lib/metadata'
import { JamMetadata } from './jam-metadata'
import './globals.css'

export const metadata: Metadata = rootHouseMetadata()

// Pause attribute still applies from sessionStorage. MotionSwitch is not
// rendered, so WATCH_MOTION_SWITCH stays false and the MutationObserver
// does not attach. Flip that flag to true when the switch is remounted.
const LOGO_PAUSE_BOOTSTRAP = `try{if(sessionStorage.getItem('lf-logo-paused')==='1'){document.documentElement.dataset.logoPaused='true'}var sync=function(){var b=document.querySelector('.lf-motion-switch');if(!b)return false;var p=document.documentElement.getAttribute('data-logo-paused')==='true';b.setAttribute('aria-checked',p?'false':'true');b.setAttribute('aria-label',p?'motion: off':'motion: on');return true};var WATCH_MOTION_SWITCH=false;if(WATCH_MOTION_SWITCH&&!sync()){var o=new MutationObserver(function(){if(sync())o.disconnect()});o.observe(document.documentElement,{childList:true,subtree:true})}}catch(e){}`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOGO_PAUSE_BOOTSTRAP }} />
        <meta name="jam:team" content="1fa5e16b-202b-4eae-8b03-dbac1fcc4157" />
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
      </head>
      <body className="antialiased min-h-screen">
        <JamMetadata />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  )
}
