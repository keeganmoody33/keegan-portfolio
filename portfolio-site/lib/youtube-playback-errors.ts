/**
 * YouTube IFrame playback errors that are video-specific.
 * 2 = invalid parameter, 5 = HTML5 player error,
 * 100 = not found, 101/150 = embedding disabled.
 *
 * @see https://developers.google.com/youtube/iframe_api_reference#onError
 */
export const YT_SKIPPABLE_ERROR_CODES: readonly number[] = [2, 5, 100, 101, 150]

export const YT_ERROR_SKIP_LIMIT = 3

/** Initial stall deadline after an error-triggered skip (`now + 10s`). */
export const YT_STALL_TIMEOUT_MS = 10_000

/** Hard cap after the first BUFFERING / CUED / new video id (`errorTime + 25s`). */
export const YT_STALL_CAP_MS = 25_000

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
  errorTime: number | null
  deadline: number | null
  progressExtended: boolean
}

const IDLE_CLOCK = {
  errorTime: null as number | null,
  deadline: null as number | null,
  progressExtended: false,
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

/** First BUFFERING / CUED / new id may extend the deadline to the cap. */
export function progressCanExtendStall(kind: YtProgressKind): boolean {
  return kind === 'buffering' || kind === 'cued' || kind === 'new_video_id'
}

/** Only PLAYING clears an armed stall. */
export function progressClearsStall(kind: YtProgressKind): boolean {
  return kind === 'playing'
}

export function progressResetsStreak(kind: YtProgressKind): boolean {
  return kind === 'ready' || kind === 'playing'
}

export function createYtErrorMachine(): YtErrorMachineState {
  return { streak: 0, stallArmed: false, dropped: false, ...IDLE_CLOCK }
}

/** Only a real onError increments the streak. */
export function ytMachineOnError(
  state: YtErrorMachineState,
  code: number,
  playlistLength?: number | null,
  now = 0
): YtErrorMachineState {
  if (state.dropped) return state
  const result = recordPlaybackError(code, state.streak, playlistLength)
  if (!isSkippablePlaybackError(code)) {
    return { ...state, stallArmed: false, ...IDLE_CLOCK }
  }
  if (result.shouldDrop) {
    return { streak: result.streak, stallArmed: false, dropped: true, ...IDLE_CLOCK }
  }
  return {
    streak: result.streak,
    stallArmed: true,
    dropped: false,
    errorTime: now,
    deadline: now + YT_STALL_TIMEOUT_MS,
    progressExtended: false,
  }
}

export function ytMachineOnProgress(
  state: YtErrorMachineState,
  kind: YtProgressKind,
  now = 0
): YtErrorMachineState {
  if (state.dropped) return state
  if (progressClearsStall(kind)) {
    return { streak: 0, stallArmed: false, dropped: false, ...IDLE_CLOCK }
  }
  if (
    state.stallArmed &&
    state.deadline !== null &&
    now >= state.deadline
  ) {
    return ytMachineOnTick(state, now)
  }
  const streak = progressResetsStreak(kind) ? 0 : state.streak
  if (
    state.stallArmed &&
    !state.progressExtended &&
    progressCanExtendStall(kind) &&
    state.errorTime !== null
  ) {
    return {
      ...state,
      streak,
      deadline: state.errorTime + YT_STALL_CAP_MS,
      progressExtended: true,
    }
  }
  return { ...state, streak, dropped: false }
}

/** Drop only when the current deadline has passed. Never increments the streak. */
export function ytMachineOnTick(
  state: YtErrorMachineState,
  now: number
): YtErrorMachineState {
  if (state.dropped || !state.stallArmed) return state
  if (state.deadline === null || now < state.deadline) return state
  return { ...state, stallArmed: false, dropped: true }
}

/** Stall timeout never increments the streak. */
export function ytMachineOnStall(
  state: YtErrorMachineState,
  now?: number
): YtErrorMachineState {
  if (now !== undefined) return ytMachineOnTick(state, now)
  if (state.dropped || !state.stallArmed) return state
  return { ...state, stallArmed: false, dropped: true }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function isBannerDotControl(el: Element): boolean {
  if (el.closest('[data-banner-dots]')) return true
  const label = el.getAttribute('aria-label') || ''
  return label.startsWith('Switch to')
}

/** Play/Pause lives in the dropping slide — never a post-drop target. */
export function isNowPlayingControl(el: Element): boolean {
  if (el.closest('[data-now-playing]')) return true
  const label = el.getAttribute('aria-label') || ''
  return label === 'Play' || label === 'Pause'
}

export function firstFocusableIn(root: ParentNode): HTMLElement | null {
  const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE)
  for (const el of nodes) {
    if (el.closest('[inert]')) continue
    if (el.getAttribute('aria-hidden') === 'true') continue
    if (isBannerDotControl(el)) continue
    if (isNowPlayingControl(el)) continue
    return el
  }
  return null
}

/**
 * After Now Playing drops, land on the next visible slide's first
 * focusable control — never a rotator dot — or the first nav link.
 * `afterUnmount` is for the post-render handoff once the slide is gone.
 */
export function resolveFocusAfterNowPlayingDrop(opts: {
  playerRoot: Element | null
  activeElement: Element | null
  root: ParentNode
  afterUnmount?: boolean
}): HTMLElement | null {
  const { playerRoot, activeElement, root, afterUnmount } = opts
  if (!afterUnmount) {
    if (!playerRoot || !activeElement || !playerRoot.contains(activeElement)) {
      return null
    }
  }

  const header =
    playerRoot?.closest('header') ??
    (root as Document).querySelector?.('header') ??
    null
  const panels = [...(header?.querySelectorAll('[data-banner-panel]') ?? [])].filter(
    (panel): panel is HTMLElement => panel instanceof HTMLElement
  )

  const pickFromPanel = (panel: HTMLElement, ignoreInert: boolean): HTMLElement | null => {
    if (playerRoot && panel.contains(playerRoot)) return null
    if (panel.querySelector('[data-now-playing]')) return null
    if (panel.classList.contains('hidden')) return null
    if (!ignoreInert) {
      if (panel.getAttribute('aria-hidden') === 'true') return null
      if (panel.hasAttribute('inert')) return null
    }
    if (ignoreInert) {
      const nodes = panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      for (const el of nodes) {
        if (isBannerDotControl(el)) continue
        if (isNowPlayingControl(el)) continue
        if (el.getAttribute('aria-hidden') === 'true') continue
        return el
      }
      return null
    }
    return firstFocusableIn(panel)
  }

  for (const panel of panels) {
    const focusable = pickFromPanel(panel, false)
    if (focusable) return focusable
  }

  // After unmount the remaining slide may still be inert for one frame.
  if (afterUnmount) {
    for (const panel of panels) {
      const focusable = pickFromPanel(panel, true)
      if (focusable) return focusable
    }
  }

  const leftoverPanels = panels.filter((panel) => {
    if (panel.classList.contains('hidden')) return false
    if (playerRoot && panel.contains(playerRoot)) return false
    if (panel.querySelector('[data-now-playing]')) return false
    return true
  })
  const rotator =
    header?.querySelector('[data-banner-rotator]') ??
    (root as Document).querySelector?.('[data-banner-rotator]') ??
    null
  // Only the rotator that will survive the drop — zero leftover slides
  // collapses BannerRotator, which would dump focus to body.
  if (leftoverPanels.length > 0 && rotator instanceof HTMLElement) return rotator

  const nav =
    (root as Document).querySelector?.('nav') ??
    header?.querySelector('nav') ??
    null
  return nav ? firstFocusableIn(nav) : null
}

let pendingNowPlayingFocusHandoff = false

export const NOW_PLAYING_FOCUS_OPTIONS: FocusOptions = { preventScroll: true }

function closestAttr(el: Element, sel: string): boolean {
  return typeof (el as { closest?: (s: string) => Element | null }).closest === 'function'
    ? !!(el as Element).closest(sel)
    : false
}

/** True only when focus is still inside the Now Playing slide. Body is not. */
export function isFocusInsideNowPlaying(
  playerRoot: Element | null,
  active: Element | null
): boolean {
  if (!active) return false
  if (playerRoot && typeof playerRoot.contains === 'function' && playerRoot.contains(active)) {
    return true
  }
  return closestAttr(active, '[data-now-playing]')
}

/**
 * Arm the drop handoff only for focus still inside the banner rotator:
 * the Now Playing slide or the dots chrome. Never body. Never nav.
 */
export function shouldArmNowPlayingFocusHandoff(
  playerRoot: Element | null,
  active: Element | null
): boolean {
  if (!active) return false
  const tag = (active as { nodeName?: string }).nodeName
  if (tag === 'BODY' || tag === 'HTML') return false
  if (playerRoot && typeof playerRoot.contains === 'function' && playerRoot.contains(active)) {
    return true
  }
  if (closestAttr(active, '[data-banner-rotator]')) return true
  if (closestAttr(active, '[data-now-playing]')) return true
  if (closestAttr(active, '[data-banner-dots]')) return true
  return isBannerDotControl(active)
}

/** Only records a handoff if focus is inside the banner rotator. */
export function requestNowPlayingFocusHandoff(playerRoot: Element | null): void {
  if (typeof document === 'undefined') return
  const active = document.activeElement
  if (!shouldArmNowPlayingFocusHandoff(playerRoot, active)) return
  pendingNowPlayingFocusHandoff = true
  // Do not flush in a microtask: the dropping slide is still mounted and
  // its Play button would win, then unmount and dump focus to body.
  // BannerRotator flushes after visibleIndices updates; these retries
  // cover the frame after that paint.
  const retry = () => {
    flushNowPlayingFocusHandoff()
  }
  window.setTimeout(retry, 0)
  window.setTimeout(retry, 32)
  window.setTimeout(retry, 100)
  window.setTimeout(retry, 250)
}

export function flushNowPlayingFocusHandoff(root?: ParentNode): HTMLElement | null {
  if (!pendingNowPlayingFocusHandoff) return null
  if (typeof document === 'undefined') return null
  const target = resolveFocusAfterNowPlayingDrop({
    playerRoot: null,
    activeElement: null,
    root: root ?? document,
    afterUnmount: true,
  })
  if (!target) return null
  // Focusing inside inert is rejected by the browser and dumps to body.
  if (target.closest('[inert]')) return null
  pendingNowPlayingFocusHandoff = false
  target.focus(NOW_PLAYING_FOCUS_OPTIONS)
  return target
}

export const NOW_PLAYING_LIVE_ID = 'yt-now-playing-live'
export const NOW_PLAYING_UNAVAILABLE_TEXT = 'Now Playing unavailable'
export const YT_RECOVERY_TITLE = 'Track unavailable, skipping…'

export type NowPlayingRecoveryPresentation = {
  ariaBusy: boolean
  ariaDisabled: boolean
  title: string | null
  hideTime: boolean
  hideAuthor: boolean
}

export function nowPlayingRecoveryPresentation(
  recovering: boolean
): NowPlayingRecoveryPresentation {
  if (!recovering) {
    return {
      ariaBusy: false,
      ariaDisabled: false,
      title: null,
      hideTime: false,
      hideAuthor: false,
    }
  }
  return {
    ariaBusy: true,
    ariaDisabled: true,
    title: YT_RECOVERY_TITLE,
    hideTime: true,
    hideAuthor: true,
  }
}

/** Writes into the React-mounted live region. Does not create a node. */
export function announceNowPlayingUnavailable(): void {
  if (typeof document === 'undefined') return
  const node = document.getElementById(NOW_PLAYING_LIVE_ID)
  if (node) node.textContent = NOW_PLAYING_UNAVAILABLE_TEXT
}
