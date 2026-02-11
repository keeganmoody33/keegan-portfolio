/**
 * YouTube Player Service for Turntable Loading Page
 * 
 * Provides a reusable YouTube player that can be instantiated in the loading page
 * and communicates state via sessionStorage for handoff to the banner player.
 * 
 * Critical: playVideo() MUST be called synchronously in click handlers (no async gaps)
 * to comply with browser autoplay policies.
 */

// ── Constants ──────────────────────────────────────────────────
export const PLAYLIST_ID = 'PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk'
export const SESSION_KEY = 'yt-player-state'

// ── Types ──────────────────────────────────────────────────────
export interface YouTubePlayerState {
  videoId: string
  trackTitle: string
  trackAuthor: string
  position: number
  duration: number
  playing: boolean
  playlistIndex: number
  volume: number
  timestamp: number
}

export interface PlayerCallbacks {
  onReady?: (player: YT.Player) => void
  onStateChange?: (state: YT.PlayerState, player: YT.Player) => void
  onError?: (error: number, player: YT.Player) => void
}

export interface CreatePlayerOptions {
  containerId: string
  callbacks?: PlayerCallbacks
  initialVolume?: number
}

// ── Session Storage Helpers ───────────────────────────────────
export function saveStateToSession(state: YouTubePlayerState): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
  } catch {
    // sessionStorage may be unavailable (SSR, private browsing quota)
  }
}

export function loadStateFromSession(): YouTubePlayerState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as YouTubePlayerState) : null
  } catch {
    return null
  }
}

export function clearSessionState(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Ignore errors
  }
}

// ── State Extraction Helper ───────────────────────────────────
/**
 * Extracts the current player state for sessionStorage.
 * Must be called synchronously to get accurate data.
 */
export function extractPlayerState(
  player: YT.Player,
  isPlaying: boolean
): YouTubePlayerState | null {
  try {
    const data = player.getVideoData()
    return {
      videoId: data?.video_id || '',
      trackTitle: data?.title || '',
      trackAuthor: data?.author || '',
      position: player.getCurrentTime() || 0,
      duration: player.getDuration() || 0,
      playing: isPlaying,
      playlistIndex: player.getPlaylistIndex() || 0,
      volume: player.getVolume() || 50,
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// ── Player Instance Manager ───────────────────────────────────
let activePlayer: YT.Player | null = null
let activeContainerId: string | null = null

/**
 * Returns the currently active player instance (if any)
 */
export function getActivePlayer(): YT.Player | null {
  return activePlayer
}

/**
 * Creates a new YouTube player instance.
 * 
 * IMPORTANT: The returned player is not immediately usable. Wait for onReady callback
 * or check player.getPlayerState() !== YT.PlayerState.UNSTARTED.
 */
export function createPlayer(options: CreatePlayerOptions): YT.Player {
  const { containerId, callbacks = {}, initialVolume = 50 } = options

  if (typeof window === 'undefined') {
    throw new Error('createPlayer() must be called in browser context')
  }

  if (!window.YT?.Player) {
    throw new Error('YouTube IFrame API not loaded. Load https://www.youtube.com/iframe_api first.')
  }

  // Clean up any existing player using the same container
  if (activePlayer && activeContainerId === containerId) {
    destroyPlayer()
  }

  // Ensure container element exists
  const container = document.getElementById(containerId)
  if (!container) {
    throw new Error(`Container element with id "${containerId}" not found`)
  }

  const player = new YT.Player(containerId, {
    height: 200,
    width: 200,
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      enablejsapi: 1,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      list: PLAYLIST_ID,
      listType: 'playlist',
    },
    events: {
      onReady: (event: YT.PlayerEvent) => {
        const p = event.target
        
        // Set initial volume
        p.setVolume(initialVolume)
        
        // Restore previous state if available and recent
        const saved = loadStateFromSession()
        if (saved?.playing && Date.now() - saved.timestamp < 30_000) {
          // Resume from saved position
          if (saved.position > 0) {
            p.seekTo(saved.position, true)
          }
        }
        
        callbacks.onReady?.(p)
      },

      onStateChange: (event: YT.OnStateChangeEvent) => {
        const p = event.target
        const state = event.data
        
        // Auto-save state on state changes
        const isPlaying = state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING
        const playerState = extractPlayerState(p, isPlaying)
        if (playerState) {
          saveStateToSession(playerState)
        }
        
        callbacks.onStateChange?.(state, p)
      },

      onError: (event: YT.OnErrorEvent) => {
        callbacks.onError?.(event.data, event.target)
      },
    },
  })

  activePlayer = player
  activeContainerId = containerId

  return player
}

/**
 * Plays the current video. 
 * 
 * CRITICAL: This function is designed to be called SYNCHRONOUSLY within a click
 * handler. Do NOT wrap in a Promise, setTimeout, or async function before calling.
 * Browsers block audio autoplay unless the play call is directly triggered by
 * a user gesture.
 * 
 * @example
 * button.addEventListener('click', () => {
 *   // ✅ CORRECT: Direct synchronous call
 *   playVideo(player)
 *   
 *   // ❌ WRONG: Async gap breaks autoplay permission
 *   // setTimeout(() => playVideo(player), 0)
 * })
 */
export function playVideo(player: YT.Player | null): void {
  if (!player) {
    console.warn('playVideo() called with null player')
    return
  }
  try {
    player.playVideo()
  } catch (err) {
    console.error('Failed to play video:', err)
  }
}

/**
 * Pauses the current video.
 */
export function pauseVideo(player: YT.Player | null): void {
  if (!player) return
  try {
    player.pauseVideo()
  } catch (err) {
    console.error('Failed to pause video:', err)
  }
}

/**
 * Destroys the active player and cleans up resources.
 * Call this when the component unmounts or before creating a new player.
 */
export function destroyPlayer(): void {
  if (activePlayer) {
    try {
      activePlayer.destroy()
    } catch {
      // Ignore destruction errors
    }
    activePlayer = null
    activeContainerId = null
  }
}

/**
 * Seeks to a specific time in the current video.
 */
export function seekTo(player: YT.Player | null, seconds: number): void {
  if (!player) return
  try {
    player.seekTo(seconds, true)
  } catch (err) {
    console.error('Failed to seek:', err)
  }
}

/**
 * Sets the player volume (0-100).
 */
export function setVolume(player: YT.Player | null, volume: number): void {
  if (!player) return
  try {
    player.setVolume(Math.max(0, Math.min(100, volume)))
  } catch (err) {
    console.error('Failed to set volume:', err)
  }
}

/**
 * Advances to the next video in the playlist.
 */
export function nextVideo(player: YT.Player | null): void {
  if (!player) return
  try {
    player.nextVideo()
  } catch (err) {
    console.error('Failed to skip to next video:', err)
  }
}

/**
 * Goes to the previous video in the playlist.
 */
export function previousVideo(player: YT.Player | null): void {
  if (!player) return
  try {
    player.previousVideo()
  } catch (err) {
    console.error('Failed to skip to previous video:', err)
  }
}

/**
 * Gets the current playback state from sessionStorage for handoff to banner player.
 * Returns null if no valid state exists.
 */
export function getHandoffState(): YouTubePlayerState | null {
  const state = loadStateFromSession()
  if (!state) return null
  
  // Only return state if it's recent (< 30 seconds old)
  if (Date.now() - state.timestamp > 30_000) {
    return null
  }
  
  return state
}

/**
 * Checks if the YouTube API is loaded and ready.
 */
export function isYouTubeApiReady(): boolean {
  return typeof window !== 'undefined' && !!window.YT?.Player
}

/**
 * Waits for the YouTube API to load.
 * Returns a promise that resolves when the API is ready.
 */
export function waitForYouTubeApi(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isYouTubeApiReady()) {
      resolve()
      return
    }

    const startTime = Date.now()
    const interval = setInterval(() => {
      if (isYouTubeApiReady()) {
        clearInterval(interval)
        resolve()
        return
      }

      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval)
        reject(new Error('YouTube API failed to load within timeout'))
      }
    }, 100)

    // Also hook into the global callback if available
    const originalCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      originalCallback?.()
      clearInterval(interval)
      resolve()
    }
  })
}
