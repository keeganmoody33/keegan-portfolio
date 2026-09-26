/**
 * YouTube IFrame playback errors that are video-specific.
 * 2 = invalid parameter, 5 = HTML5 player error,
 * 100 = not found, 101/150 = embedding disabled.
 *
 * @see https://developers.google.com/youtube/iframe_api_reference#onError
 */
export const YT_SKIPPABLE_ERROR_CODES: readonly number[] = [2, 5, 100, 101, 150]

export const YT_ERROR_SKIP_LIMIT = 3

/** Single stall window after an error-triggered skip. Matches the hung-load timeout. */
export const YT_STALL_TIMEOUT_MS = 10_000

export type YtProgressKind =
  | 'ready'
  | 'playing'
  | 'buffering'
  | 'cued'
  | 'new_video_id'

export type YtErrorMachineState = {
  streak: number
  stallArmed: boolean
  dropped: boolean
}

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

export function progressCancelsStall(kind: YtProgressKind): boolean {
  return (
    kind === 'ready' ||
    kind === 'playing' ||
    kind === 'buffering' ||
    kind === 'cued' ||
    kind === 'new_video_id'
  )
}

export function progressResetsStreak(kind: YtProgressKind): boolean {
  return kind === 'ready' || kind === 'playing'
}

export function createYtErrorMachine(): YtErrorMachineState {
  return { streak: 0, stallArmed: false, dropped: false }
}

/** Only a real onError increments the streak. */
export function ytMachineOnError(
  state: YtErrorMachineState,
  code: number,
  playlistLength?: number | null
): YtErrorMachineState {
  if (state.dropped) return state
  const result = recordPlaybackError(code, state.streak, playlistLength)
  if (!isSkippablePlaybackError(code)) {
    return { ...state, stallArmed: false }
  }
  if (result.shouldDrop) {
    return { streak: result.streak, stallArmed: false, dropped: true }
  }
  return { streak: result.streak, stallArmed: true, dropped: false }
}

export function ytMachineOnProgress(
  state: YtErrorMachineState,
  kind: YtProgressKind
): YtErrorMachineState {
  if (state.dropped) return state
  return {
    streak: progressResetsStreak(kind) ? 0 : state.streak,
    stallArmed: false,
    dropped: false,
  }
}

/** Stall timeout never increments the streak. */
export function ytMachineOnStall(state: YtErrorMachineState): YtErrorMachineState {
  if (state.dropped || !state.stallArmed) return state
  return { ...state, stallArmed: false, dropped: true }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function firstFocusableIn(root: ParentNode): HTMLElement | null {
  const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE)
  for (const el of nodes) {
    if (el.closest('[inert]')) continue
    if (el.getAttribute('aria-hidden') === 'true') continue
    return el
  }
  return null
}

/**
 * If focus is inside the Now Playing widget, move it to the next visible
 * banner slide or the first nav control before the slide unmounts.
 */
export function resolveFocusAfterNowPlayingDrop(opts: {
  playerRoot: Element | null
  activeElement: Element | null
  root: ParentNode
}): HTMLElement | null {
  const { playerRoot, activeElement, root } = opts
  if (!playerRoot || !activeElement || !playerRoot.contains(activeElement)) {
    return null
  }

  const header =
    playerRoot.closest('header') ??
    (root as Document).querySelector?.('header') ??
    null
  const rotator = header?.querySelector(':scope > div.relative')
  if (rotator) {
    for (const panel of rotator.children) {
      if (!(panel instanceof HTMLElement)) continue
      if (panel.contains(playerRoot)) continue
      if (panel.classList.contains('hidden')) continue
      if (panel.getAttribute('aria-hidden') === 'true') continue
      if (panel.hasAttribute('inert')) continue
      const focusable = firstFocusableIn(panel)
      if (focusable) return focusable
    }
  }

  const nav =
    (root as Document).querySelector?.('nav') ??
    header?.querySelector('nav') ??
    null
  return nav ? firstFocusableIn(nav) : null
}

export function moveFocusAfterNowPlayingDrop(playerRoot: Element | null): void {
  if (typeof document === 'undefined') return
  const target = resolveFocusAfterNowPlayingDrop({
    playerRoot,
    activeElement: document.activeElement,
    root: document,
  })
  target?.focus()
}

const LIVE_REGION_ID = 'yt-now-playing-live'

/** Body-owned so the announcement survives BannerRotator unmounting this slide. */
export function announceNowPlayingUnavailable(): void {
  if (typeof document === 'undefined') return
  let node = document.getElementById(LIVE_REGION_ID)
  if (!node) {
    node = document.createElement('div')
    node.id = LIVE_REGION_ID
    node.setAttribute('role', 'status')
    node.setAttribute('aria-live', 'polite')
    node.className = 'sr-only'
    document.body.appendChild(node)
  }
  node.textContent = ''
  window.requestAnimationFrame(() => {
    const live = document.getElementById(LIVE_REGION_ID)
    if (live) live.textContent = 'Now Playing unavailable'
  })
}
