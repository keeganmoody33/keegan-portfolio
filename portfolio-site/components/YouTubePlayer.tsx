'use client'

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import Script from 'next/script'
import posthog from 'posthog-js'
import { useBannerAvailability, useBannerPanelPad } from '@/components/BannerRotator'
import {
  createYtErrorMachine,
  moveFocusAfterNowPlayingDrop,
  playlistLengthFromPlayer,
  ytMachineOnError,
  ytMachineOnProgress,
  ytMachineOnStall,
  YT_STALL_TIMEOUT_MS,
  type YtErrorMachineState,
  type YtProgressKind,
} from '@/lib/youtube-playback-errors'

// ── Constants ──────────────────────────────────────────────────
const PLAYLIST_ID = 'PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk'
const SESSION_KEY = 'yt-player-state'

// ── sessionStorage contract (Phase 2 Turntable handoff) ──────
interface YouTubePlayerState {
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

function saveState(state: YouTubePlayerState) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
  } catch {
    // sessionStorage may be unavailable (SSR, private browsing quota)
  }
}

function loadState(): YouTubePlayerState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as YouTubePlayerState) : null
  } catch {
    return null
  }
}

// ── Helpers ────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Component ──────────────────────────────────────────────────
export default function YouTubePlayer() {
  const reactId = useId()
  const playerRef = useRef<YT.Player | null>(null)
  const containerRef = useRef<string>(`yt-player-${reactId.replace(/:/g, '')}`)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const playerRootRef = useRef<HTMLDivElement>(null)
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const errorMachine = useRef(createYtErrorMachine())
  const lastVideoId = useRef('')
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stallGen = useRef(0)
  const droppedRef = useRef(false)

  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [dropAnnouncement, setDropAnnouncement] = useState('')
  const [playing, setPlaying] = useState(false)
  const [trackTitle, setTrackTitle] = useState('')
  const [trackAuthor, setTrackAuthor] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(50)
  const [expanded, setExpanded] = useState(false)

  // ── Persist state to sessionStorage ───────────────────────
  // Derives playing from player.getPlayerState() instead of React state
  // to avoid stale closure when called from onStateChange (React state
  // updates are async, but getPlayerState() is synchronous and always current).
  const clearStallTimer = useCallback(() => {
    if (stallTimer.current !== null) {
      clearTimeout(stallTimer.current)
      stallTimer.current = null
    }
    stallGen.current += 1
  }, [])

  const dropNowPlaying = useCallback(() => {
    if (droppedRef.current) return
    droppedRef.current = true
    clearStallTimer()
    moveFocusAfterNowPlayingDrop(playerRootRef.current)
    setDropAnnouncement('Now Playing unavailable')
    setError(true)
    setIsLoading(false)
  }, [clearStallTimer])

  const applyMachine = useCallback(
    (next: YtErrorMachineState) => {
      errorMachine.current = next
      if (next.dropped) {
        dropNowPlaying()
        return
      }
      if (!next.stallArmed) clearStallTimer()
    },
    [clearStallTimer, dropNowPlaying]
  )

  const noteProgress = useCallback(
    (kind: YtProgressKind) => {
      applyMachine(ytMachineOnProgress(errorMachine.current, kind))
    },
    [applyMachine]
  )

  const armStallTimer = useCallback(() => {
    clearStallTimer()
    const gen = ++stallGen.current
    stallTimer.current = setTimeout(() => {
      if (gen !== stallGen.current) return
      applyMachine(ytMachineOnStall(errorMachine.current))
    }, YT_STALL_TIMEOUT_MS)
  }, [applyMachine, clearStallTimer])

  const persistState = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    try {
      const data = player.getVideoData()
      const playerState = player.getPlayerState()
      saveState({
        videoId: data?.video_id || '',
        trackTitle: data?.title || '',
        trackAuthor: data?.author || '',
        position: player.getCurrentTime() || 0,
        duration: player.getDuration() || 0,
        playing: playerState === YT.PlayerState.PLAYING || playerState === YT.PlayerState.BUFFERING,
        playlistIndex: player.getPlaylistIndex() || 0,
        volume: player.getVolume() || 50,
        timestamp: Date.now(),
      })
    } catch {
      // player may not be fully initialised yet
    }
  }, [])

  // ── Update track info from player ────────────────────────
  const syncTrackInfo = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    try {
      const data = player.getVideoData()
      if (data?.title) setTrackTitle(data.title)
      if (data?.author) setTrackAuthor(data.author)
      setDuration(player.getDuration() || 0)
    } catch {
      // not ready yet
    }
  }, [])

  // ── Progress ticker ──────────────────────────────────────
  useEffect(() => {
    if (playing && isReady) {
      progressInterval.current = setInterval(() => {
        const player = playerRef.current
        if (player) {
          setCurrentTime(player.getCurrentTime() || 0)
          persistState()
        }
      }, 1000)
    } else if (progressInterval.current) {
      clearInterval(progressInterval.current)
      progressInterval.current = null
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current)
    }
  }, [playing, isReady, persistState])

  // ── Initialise YT.Player once API is loaded ──────────────
  const initPlayer = useCallback(() => {
    if (playerRef.current) return

    // Re-create container element if a previous destroy() removed it.
    // YT.Player replaces the target <div> with an <iframe>; destroy()
    // removes that iframe entirely. React doesn't know the DOM was
    // mutated, so the element is simply gone on the next init attempt
    // (happens in React 18 strict mode and after HMR).
    if (!document.getElementById(containerRef.current)) {
      const el = document.createElement('div')
      el.id = containerRef.current
      wrapperRef.current?.appendChild(el)
    }

    const saved = loadState()

    const player = new YT.Player(containerRef.current, {
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
          playerRef.current = p
          noteProgress('ready')

          // Hidden iframe must stay mounted for audio, but it is not a
          // control. tabindex=-1 is a second guard behind wrapper `inert`.
          try {
            p.getIframe().tabIndex = -1
          } catch {
            // iframe may not be queryable yet
          }

          // Restore volume
          p.setVolume(saved?.volume ?? 50)
          setVolume(saved?.volume ?? 50)

          setIsReady(true)
          setIsLoading(false)

          // Small delay to let playlist metadata load
          setTimeout(() => {
            syncTrackInfo()

            // If Phase 2 turntable handed off a playing state, resume
            if (saved?.playing && Date.now() - saved.timestamp < 30_000) {
              if (saved.position > 0) p.seekTo(saved.position, true)
              setCurrentTime(saved.position)
              setDuration(saved.duration || 0)
              p.playVideo()
            }

            posthog.capture('youtube_player_loaded', {
              playlist_id: PLAYLIST_ID,
              autoplay: false,
            })
          }, 500)
        },

        onStateChange: (event: YT.OnStateChangeEvent) => {
          const state = event.data

          if (state === YT.PlayerState.PLAYING) {
            noteProgress('playing')
            setPlaying(true)
            syncTrackInfo()

            const data = event.target.getVideoData()
            posthog.capture('youtube_player_play', {
              track_title: data?.title,
              track_author: data?.author,
              playlist_index: event.target.getPlaylistIndex(),
            })
          }

          if (state === YT.PlayerState.BUFFERING) {
            noteProgress('buffering')
          }

          if (state === YT.PlayerState.CUED) {
            noteProgress('cued')
          }

          try {
            const videoId = event.target.getVideoData()?.video_id || ''
            if (videoId && videoId !== lastVideoId.current) {
              lastVideoId.current = videoId
              noteProgress('new_video_id')
            }
          } catch {
            // playlist metadata may not be ready
          }

          if (state === YT.PlayerState.PAUSED) {
            setPlaying(false)

            const data = event.target.getVideoData()
            posthog.capture('youtube_player_pause', {
              track_title: data?.title,
              position: event.target.getCurrentTime(),
              duration: event.target.getDuration(),
            })
          }

          if (state === YT.PlayerState.ENDED) {
            setPlaying(false)
          }

          // Always persist
          persistState()
        },

        onError: (event: YT.OnErrorEvent) => {
          console.error('YouTubePlayer: playback error', event.data)
          // Keep the embed mounted for skip attempts; tabindex=-1 stays
          // a second guard behind wrapper `inert`. Only a real onError
          // increments the streak. After N skippable errors (3, or
          // playlist length if shorter) drop the slide. A single 10s
          // stall window covers the VM case where 150 fires once.
          try {
            event.target.getIframe().tabIndex = -1
          } catch {
            dropNowPlaying()
            return
          }

          const next = ytMachineOnError(
            errorMachine.current,
            event.data,
            playlistLengthFromPlayer(event.target)
          )
          applyMachine(next)
          if (next.dropped || !next.stallArmed) return

          try {
            event.target.nextVideo()
          } catch {
            dropNowPlaying()
            return
          }
          // nextVideo() can fire BUFFERING/CUED synchronously — only
          // arm the stall if progress did not already cancel it.
          if (errorMachine.current.stallArmed) armStallTimer()
        },
      },
    })

    playerRef.current = player
  }, [syncTrackInfo, persistState, noteProgress, applyMachine, armStallTimer, dropNowPlaying])

  // ── Hook into the global callback ────────────────────────
  useEffect(() => {
    // If YT is already loaded (e.g. hot-reload), init immediately
    if (typeof window !== 'undefined' && window.YT?.Player) {
      initPlayer()
      return
    }

    // Otherwise, queue for when the script finishes
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      initPlayer()
    }

    return () => {
      // Cleanup on unmount
      if (progressInterval.current) clearInterval(progressInterval.current)
      clearStallTimer()
      try {
        const p = playerRef.current
        playerRef.current = null      // clear ref BEFORE destroy so re-init isn't blocked
        p?.destroy()
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drop the slide if the IFrame API never appears. Starts on mount so a
  // stalled <Script> cannot leave the skeleton rotating indefinitely.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!playerRef.current) {
        console.error('YouTubePlayer: iframe API timed out')
        dropNowPlaying()
      }
    }, 10_000)
    return () => window.clearTimeout(timer)
  }, [dropNowPlaying])

  // ── Script onLoad fallback — covers the race where the
  //    <Script> fires before the useEffect sets the callback ─
  const handleScriptLoad = useCallback(() => {
    // Small delay to let YouTube set window.YT.Player
    const poll = setInterval(() => {
      if (window.YT?.Player) {
        clearInterval(poll)
        initPlayer()
      }
    }, 100)
    setTimeout(() => clearInterval(poll), 10_000)
  }, [initPlayer])

  // ── Controls ─────────────────────────────────────────────
  const handlePlayPause = () => {
    const player = playerRef.current
    if (!player) return
    if (playing) {
      player.pauseVideo()
    } else {
      player.playVideo()
    }
  }

  const handleNext = () => {
    const player = playerRef.current
    if (!player) return
    const prevData = player.getVideoData()
    player.nextVideo()
    setTimeout(() => {
      syncTrackInfo()
      const nextData = player.getVideoData()
      posthog.capture('youtube_track_changed', {
        from_track: prevData?.title,
        to_track: nextData?.title,
        method: 'next',
      })
    }, 300)
  }

  const handlePrev = () => {
    const player = playerRef.current
    if (!player) return
    const prevData = player.getVideoData()
    player.previousVideo()
    setTimeout(() => {
      syncTrackInfo()
      const nextData = player.getVideoData()
      posthog.capture('youtube_track_changed', {
        from_track: prevData?.title,
        to_track: nextData?.title,
        method: 'prev',
      })
    }, 300)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setVolume(v)
    playerRef.current?.setVolume(v)
    persistState()
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value)
    setCurrentTime(t)
    playerRef.current?.seekTo(t, true)
  }

  const handleScriptError = useCallback(() => {
    console.error('YouTubePlayer: iframe API failed to load')
    dropNowPlaying()
  }, [dropNowPlaying])

  // Report before any null return so BannerRotator can drop this slide
  useBannerAvailability(!error)
  const panelPad = useBannerPanelPad()

  const liveRegion =
    typeof document !== 'undefined'
      ? createPortal(
          <div role="status" aria-live="polite" className="sr-only">
            {dropAnnouncement}
          </div>,
          document.body
        )
      : null

  // ── Error → graceful hide ────────────────────────────────
  if (error) return liveRegion

  // ── Render ───────────────────────────────────────────────
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <>
      {liveRegion}
      <div ref={playerRootRef} className="contents">
      {/* Load YouTube IFrame API — must always render, even during loading,
          otherwise the script never loads and isLoading never clears (deadlock) */}
      <Script
        src="https://www.youtube.com/iframe_api"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
        onError={handleScriptError}
      />

      {/* Hidden YouTube iframe — must be ≥200×200 per API requirement */}
      <div
        ref={wrapperRef}
        className="absolute overflow-hidden"
        style={{ width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        aria-hidden="true"
        {...{ inert: true }}
      >
        <div id={containerRef.current} />
      </div>

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="min-h-12 w-full border-b border-[var(--border-dim)] bg-[var(--bg-surface)] font-mono">
          <div className={panelPad}>
            <div className="flex items-center gap-3">
              {/* Play button skeleton */}
              <div className="w-6 h-6 rounded bg-[var(--bg-body)] border border-[var(--border-dim)] animate-pulse" />
              {/* Track info skeleton */}
              <div className="flex-1 space-y-1">
                <div className="h-2.5 w-40 bg-[var(--bg-body)] border border-[var(--border-dim)] rounded animate-pulse" />
                <div className="h-2 w-24 bg-[var(--bg-body)] border border-[var(--border-dim)] rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      ) : (

        /* Visible custom controls */
        <div
          className="min-h-12 w-full border-b border-[var(--border-dim)] bg-[var(--bg-surface)] font-mono group"
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
        >
          <div className={panelPad}>
            <div className="flex items-center gap-3">
              {/* Play / Pause */}
              <button
                onClick={handlePlayPause}
                className={`
                w-6 h-6 flex items-center justify-center rounded border
                transition-colors duration-150
                ${playing
                    ? 'border-[var(--accent-lime)] text-[var(--accent-lime)]'
                    : 'border-[var(--border-dim)] text-[var(--text-muted)] hover:text-[var(--accent-lime)] hover:border-[var(--accent-lime)]'
                  }
              `}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? (
                  // Pause icon
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="currentColor">
                    <rect x="2" y="1" width="3.5" height="12" rx="0.5" />
                    <rect x="8.5" y="1" width="3.5" height="12" rx="0.5" />
                  </svg>
                ) : (
                  // Play icon
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="currentColor">
                    <polygon points="3,1 12,7 3,13" />
                  </svg>
                )}
              </button>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p className="text-[var(--text-bright)] text-xs truncate">
                  {trackTitle || 'Loading playlist...'}
                </p>
                <p className="text-[var(--text-muted)] text-[10px] truncate">
                  {trackAuthor || '\u00A0'}
                </p>
              </div>

              {/* Compact: just show time */}
              <span className="text-[var(--text-muted)] text-[10px] tabular-nums">
                {playing || currentTime > 0
                  ? `${formatTime(currentTime)} / ${formatTime(duration)}`
                  : ''}
              </span>

              {/* Expanded controls — prev / next */}
              <div
                className={`
                flex items-center gap-2 overflow-hidden transition-all duration-200
                ${expanded ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}
              `}
              >
                <button
                  onClick={handlePrev}
                  className="text-[var(--text-muted)] hover:text-[var(--accent-lime)] transition-colors"
                  aria-label="Previous track"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <rect x="0" y="1" width="2" height="10" />
                    <polygon points="12,1 4,6 12,11" />
                  </svg>
                </button>
                <button
                  onClick={handleNext}
                  className="text-[var(--text-muted)] hover:text-[var(--accent-lime)] transition-colors"
                  aria-label="Next track"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <polygon points="0,1 8,6 0,11" />
                    <rect x="10" y="1" width="2" height="10" />
                  </svg>
                </button>

                {/* Volume */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 accent-[var(--accent-lime)] cursor-pointer"
                  aria-label="Volume"
                />
              </div>
            </div>

            {/* Progress bar — always visible when playing */}
            {(playing || currentTime > 0) && (
              <div className="mt-2 relative group/progress">
                {/* Background track */}
                <div className="h-[2px] w-full bg-[var(--border-dim)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent-lime)] transition-[width] duration-1000 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {/* Seekable range (appears on hover) */}
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  role="slider"
                  aria-label="Track position"
                  aria-valuenow={Math.floor(currentTime)}
                  aria-valuemin={0}
                  aria-valuemax={Math.floor(duration || 1)}
                />
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  )
}