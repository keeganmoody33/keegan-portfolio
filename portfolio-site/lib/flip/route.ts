/**
 * Single route constant so the flip room is easy to move.
 * Preview-only. Do not treat this as a production path until Keegan says so.
 */
export const FLIP_PATH = '/flip' as const

export function flipHrefForTrack(title: string, artist?: string): string {
  const songTitle = title.trim()
  const songArtist = artist?.trim() ?? ''
  if (!songTitle && !songArtist) return FLIP_PATH
  const params = new URLSearchParams()
  if (songTitle) params.set('title', songTitle)
  if (songArtist) params.set('artist', songArtist)
  return `${FLIP_PATH}?${params.toString()}`
}
