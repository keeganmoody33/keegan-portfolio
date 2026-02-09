/**
 * YouTube IFrame Player API type declarations.
 *
 * Covers the subset of the API used by the YouTubePlayer widget:
 * playlist loading, playback controls, track info, and events.
 *
 * @see https://developers.google.com/youtube/iframe_api_reference
 */

interface Window {
  YT: typeof YT
  onYouTubeIframeAPIReady: (() => void) | undefined
}

declare namespace YT {
  /** Player state constants returned by getPlayerState() */
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  interface PlayerOptions {
    width?: number | string
    height?: number | string
    videoId?: string
    playerVars?: PlayerVars
    events?: PlayerEvents
  }

  interface PlayerVars {
    autoplay?: 0 | 1
    controls?: 0 | 1
    disablekb?: 0 | 1
    enablejsapi?: 0 | 1
    loop?: 0 | 1
    modestbranding?: 0 | 1
    origin?: string
    playsinline?: 0 | 1
    rel?: 0 | 1
    list?: string
    listType?: 'playlist' | 'user_uploads'
    start?: number
    [key: string]: unknown
  }

  interface PlayerEvents {
    onReady?: (event: PlayerEvent) => void
    onStateChange?: (event: OnStateChangeEvent) => void
    onError?: (event: OnErrorEvent) => void
    onAutoplayBlocked?: () => void
  }

  interface PlayerEvent {
    target: Player
  }

  interface OnStateChangeEvent {
    target: Player
    data: PlayerState
  }

  interface OnErrorEvent {
    target: Player
    data: number
  }

  interface VideoData {
    title: string
    video_id: string
    author: string
  }

  interface PlaylistOptions {
    list: string
    listType: 'playlist' | 'user_uploads'
    index?: number
    startSeconds?: number
  }

  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions)

    // Playback
    playVideo(): void
    pauseVideo(): void
    stopVideo(): void
    seekTo(seconds: number, allowSeekAhead: boolean): void

    // Playlist
    loadPlaylist(options: PlaylistOptions): void
    cuePlaylist(options: PlaylistOptions): void
    nextVideo(): void
    previousVideo(): void
    playVideoAt(index: number): void
    getPlaylist(): string[]
    getPlaylistIndex(): number

    // Volume
    setVolume(volume: number): void
    getVolume(): number
    mute(): void
    unMute(): void
    isMuted(): boolean

    // Status
    getPlayerState(): PlayerState
    getCurrentTime(): number
    getDuration(): number
    getVideoData(): VideoData

    // Player
    getIframe(): HTMLIFrameElement
    destroy(): void
    setSize(width: number, height: number): object
  }
}
