'use client'

import { NOW_PLAYING_LIVE_ID } from '@/lib/youtube-playback-errors'

/**
 * Empty polite live region, mounted once on the career page so screen
 * readers see the node before any drop. Text is written on drop.
 */
export default function NowPlayingLiveRegion() {
  return (
    <div
      id={NOW_PLAYING_LIVE_ID}
      role="status"
      aria-live="polite"
      className="sr-only"
    />
  )
}
