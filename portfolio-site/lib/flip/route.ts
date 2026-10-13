/**
 * Single route constant so the flip room is easy to move.
 * Preview-only. Do not treat this as a production path until Keegan says so.
 */
export const FLIP_PATH = '/flip' as const

export function flipHrefForTrack(title: string, artist?: string): string {
  const q = [artist, title]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' ')
  if (!q) return FLIP_PATH
  return `${FLIP_PATH}?track=${encodeURIComponent(q)}`
}
