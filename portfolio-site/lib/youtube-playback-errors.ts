/**
 * YouTube IFrame playback errors that are video-specific.
 * 2 = invalid parameter, 5 = HTML5 player error,
 * 100 = not found, 101/150 = embedding disabled.
 *
 * @see https://developers.google.com/youtube/iframe_api_reference#onError
 */
export const YT_SKIPPABLE_ERROR_CODES: readonly number[] = [2, 5, 100, 101, 150]

export const YT_ERROR_SKIP_LIMIT = 3

export function isSkippablePlaybackError(code: number): boolean {
  return YT_SKIPPABLE_ERROR_CODES.includes(code)
}

/** Skip at most 3 videos, or the playlist length if it is shorter. */
export function playbackErrorSkipLimit(
  playlistLength: number | null | undefined
): number {
  if (
    typeof playlistLength === 'number' &&
    Number.isFinite(playlistLength) &&
    playlistLength > 0
  ) {
    return Math.min(YT_ERROR_SKIP_LIMIT, Math.floor(playlistLength))
  }
  return YT_ERROR_SKIP_LIMIT
}

export function playlistLengthFromPlayer(player: {
  getPlaylist?: () => unknown
}): number | null {
  try {
    const list = player.getPlaylist?.()
    if (Array.isArray(list) && list.length > 0) return list.length
  } catch {
    // playlist metadata may not be ready
  }
  return null
}

export function recordPlaybackError(
  code: number,
  currentStreak: number,
  playlistLength?: number | null
): { streak: number; shouldDrop: boolean; shouldSkip: boolean } {
  if (!isSkippablePlaybackError(code)) {
    return { streak: currentStreak, shouldDrop: false, shouldSkip: false }
  }
  const streak = currentStreak + 1
  const shouldDrop = streak >= playbackErrorSkipLimit(playlistLength)
  return { streak, shouldDrop, shouldSkip: !shouldDrop }
}
