/**
 * Tests for youtube-service.ts
 * Uses Node.js built-in test runner
 * 
 * Run: node --test lib/youtube-service.test.ts
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'

// Mock DOM and YouTube API before importing the module
const mockSessionStorage: Record<string, string> = {}
const mockLocalStorage: Record<string, string> = {}
let mockPlayerInstance: any = null
let ytPlayerConstructorCalls: any[] = []

// Mock sessionStorage
global.sessionStorage = {
  getItem: (key: string) => mockSessionStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockSessionStorage[key] = value },
  removeItem: (key: string) => { delete mockSessionStorage[key] },
  clear: () => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]) },
  length: 0,
  key: () => null,
} as Storage

// Mock localStorage
global.localStorage = {
  getItem: (key: string) => mockLocalStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockLocalStorage[key] = value },
  removeItem: (key: string) => { delete mockLocalStorage[key] },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]) },
  length: 0,
  key: () => null,
} as Storage

// Mock YT.Player
function createMockPlayer(elementId: string, options: any) {
  const eventHandlers: Record<string, Function> = {}
  const player = {
    playVideo: () => {},
    pauseVideo: () => {},
    stopVideo: () => {},
    seekTo: (seconds: number, allowSeekAhead: boolean) => {},
    setVolume: (volume: number) => {},
    getVolume: () => 50,
    getCurrentTime: () => 30,
    getDuration: () => 180,
    getVideoData: () => ({
      video_id: 'test123',
      title: 'Test Track',
      author: 'Test Artist',
    }),
    getPlaylistIndex: () => 0,
    getPlayerState: () => 1, // PLAYING
    nextVideo: () => {},
    previousVideo: () => {},
    destroy: () => {},
    _triggerReady: function() {
      if (options.events?.onReady) {
        options.events.onReady({ target: this })
      }
    },
    _triggerStateChange: function(state: number) {
      if (options.events?.onStateChange) {
        options.events.onStateChange({ target: this, data: state })
      }
    },
  }
  
  ytPlayerConstructorCalls.push({ elementId, options, player })
  mockPlayerInstance = player
  return player
}

// Mock document
global.document = {
  getElementById: (id: string) => ({ id }),
} as unknown as Document

// Mock window
global.window = {
  YT: {
    Player: createMockPlayer,
    PlayerState: {
      UNSTARTED: -1,
      ENDED: 0,
      PLAYING: 1,
      PAUSED: 2,
      BUFFERING: 3,
      CUED: 5,
    },
  },
  onYouTubeIframeAPIReady: undefined,
} as unknown as Window & typeof globalThis

// Also set YT as a global variable (referenced directly in youtube-service.ts)
;(global as any).YT = (global as any).window.YT

// Now import the module under test
const {
  PLAYLIST_ID,
  SESSION_KEY,
  saveStateToSession,
  loadStateFromSession,
  clearSessionState,
  extractPlayerState,
  createPlayer,
  playVideo,
  pauseVideo,
  destroyPlayer,
  seekTo,
  setVolume,
  nextVideo,
  previousVideo,
  getHandoffState,
  isYouTubeApiReady,
  waitForYouTubeApi,
} = await import('./youtube-service.ts')

describe('youtube-service', () => {
  beforeEach(() => {
    // Clear storage
    Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k])
    Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k])
    ytPlayerConstructorCalls = []
    mockPlayerInstance = null
    
    // Reset window.YT and global.YT mocks (in case previous test modified them)
    const mockYT = {
      Player: createMockPlayer,
      PlayerState: {
        UNSTARTED: -1,
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
        CUED: 5,
      },
    }
    global.window = {
      YT: mockYT,
      onYouTubeIframeAPIReady: undefined,
    } as unknown as Window & typeof globalThis
    ;(global as any).YT = mockYT
  })

  describe('Constants', () => {
    it('should export correct PLAYLIST_ID', () => {
      assert.strictEqual(PLAYLIST_ID, 'PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk')
    })

    it('should export correct SESSION_KEY', () => {
      assert.strictEqual(SESSION_KEY, 'yt-player-state')
    })
  })

  describe('saveStateToSession', () => {
    it('should save state to sessionStorage', () => {
      const state = {
        videoId: 'abc123',
        trackTitle: 'Test Song',
        trackAuthor: 'Test Artist',
        position: 45,
        duration: 180,
        playing: true,
        playlistIndex: 2,
        volume: 75,
        timestamp: Date.now(),
      }

      saveStateToSession(state)

      const saved = sessionStorage.getItem(SESSION_KEY)
      assert.notStrictEqual(saved, null)
      assert.deepStrictEqual(JSON.parse(saved!), state)
    })

    it('should not throw if sessionStorage is unavailable', () => {
      const originalSetItem = sessionStorage.setItem
      sessionStorage.setItem = () => { throw new Error('Storage disabled') }

      assert.doesNotThrow(() => {
        saveStateToSession({} as any)
      })

      sessionStorage.setItem = originalSetItem
    })
  })

  describe('loadStateFromSession', () => {
    it('should return null when no state exists', () => {
      const result = loadStateFromSession()
      assert.strictEqual(result, null)
    })

    it('should return parsed state when it exists', () => {
      const state = {
        videoId: 'xyz789',
        trackTitle: 'Another Song',
        trackAuthor: 'Another Artist',
        position: 120,
        duration: 240,
        playing: false,
        playlistIndex: 5,
        volume: 30,
        timestamp: Date.now(),
      }

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
      const result = loadStateFromSession()

      assert.deepStrictEqual(result, state)
    })

    it('should return null if JSON is invalid', () => {
      sessionStorage.setItem(SESSION_KEY, 'invalid json')
      const result = loadStateFromSession()
      assert.strictEqual(result, null)
    })
  })

  describe('clearSessionState', () => {
    it('should remove state from sessionStorage', () => {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ videoId: 'test' }))
      clearSessionState()
      const result = sessionStorage.getItem(SESSION_KEY)
      assert.ok(result === null || result === undefined)
    })
  })

  describe('extractPlayerState', () => {
    it('should extract state from player correctly', () => {
      const mockPlayer = {
        getVideoData: () => ({
          video_id: 'vid123',
          title: 'Song Title',
          author: 'Song Artist',
        }),
        getCurrentTime: () => 60,
        getDuration: () => 200,
        getPlaylistIndex: () => 3,
        getVolume: () => 80,
      } as unknown as YT.Player

      const beforeTime = Date.now()
      const result = extractPlayerState(mockPlayer, true)
      const afterTime = Date.now()

      assert.notStrictEqual(result, null)
      assert.strictEqual(result!.videoId, 'vid123')
      assert.strictEqual(result!.trackTitle, 'Song Title')
      assert.strictEqual(result!.trackAuthor, 'Song Artist')
      assert.strictEqual(result!.position, 60)
      assert.strictEqual(result!.duration, 200)
      assert.strictEqual(result!.playing, true)
      assert.strictEqual(result!.playlistIndex, 3)
      assert.strictEqual(result!.volume, 80)
      assert.ok(result!.timestamp >= beforeTime && result!.timestamp <= afterTime)
    })

    it('should handle player errors gracefully', () => {
      const brokenPlayer = {
        getVideoData: () => { throw new Error('Player not ready') },
      } as unknown as YT.Player

      const result = extractPlayerState(brokenPlayer, false)
      assert.strictEqual(result, null)
    })
  })

  describe('isYouTubeApiReady', () => {
    it('should return true when YT.Player is available', () => {
      assert.strictEqual(isYouTubeApiReady(), true)
    })

    it('should return false when YT is not available', () => {
      const originalYT = window.YT
      // @ts-ignore
      window.YT = undefined
      assert.strictEqual(isYouTubeApiReady(), false)
      window.YT = originalYT
    })
  })

  describe('createPlayer', () => {
    it('should throw in non-browser context', () => {
      const originalWindow = global.window
      // @ts-ignore
      global.window = undefined

      assert.throws(() => {
        createPlayer({ containerId: 'test' })
      }, /browser context/)

      global.window = originalWindow
    })

    it('should throw if YouTube API not loaded', () => {
      const originalYT = window.YT
      // @ts-ignore
      window.YT = undefined

      assert.throws(() => {
        createPlayer({ containerId: 'test' })
      }, /YouTube IFrame API not loaded/)

      window.YT = originalYT
    })

    it('should create player with correct options', () => {
      const onReady = () => {}
      const player = createPlayer({
        containerId: 'test-container',
        callbacks: { onReady },
        initialVolume: 60,
      })

      assert.notStrictEqual(player, null)
      assert.strictEqual(ytPlayerConstructorCalls.length, 1)
      
      const call = ytPlayerConstructorCalls[0]
      assert.strictEqual(call.elementId, 'test-container')
      
      const options = call.options
      assert.strictEqual(options.playerVars.list, PLAYLIST_ID)
      assert.strictEqual(options.playerVars.listType, 'playlist')
      assert.strictEqual(options.playerVars.autoplay, 0)
      assert.strictEqual(options.playerVars.controls, 0)
    })
  })

  describe('playVideo', () => {
    it('should call playVideo on player synchronously', () => {
      let called = false
      const player = { playVideo: () => { called = true } } as unknown as YT.Player

      playVideo(player)

      assert.strictEqual(called, true)
    })

    it('should handle null player gracefully', () => {
      assert.doesNotThrow(() => {
        playVideo(null)
      })
    })

    it('should handle player errors gracefully', () => {
      const brokenPlayer = {
        playVideo: () => { throw new Error('Player error') },
      } as unknown as YT.Player

      assert.doesNotThrow(() => {
        playVideo(brokenPlayer)
      })
    })

    it('should be callable synchronously (critical for click handlers)', () => {
      let called = false
      const player = { playVideo: () => { called = true } } as unknown as YT.Player

      // Synchronous call should complete immediately
      let completed = false
      playVideo(player)
      completed = true

      assert.strictEqual(completed, true)
      assert.strictEqual(called, true)
    })
  })

  describe('pauseVideo', () => {
    it('should call pauseVideo on player', () => {
      let called = false
      const player = { pauseVideo: () => { called = true } } as unknown as YT.Player

      pauseVideo(player)

      assert.strictEqual(called, true)
    })

    it('should handle null player gracefully', () => {
      assert.doesNotThrow(() => {
        pauseVideo(null)
      })
    })
  })

  describe('destroyPlayer', () => {
    it('should destroy active player', () => {
      // Create a player first
      createPlayer({ containerId: 'test-container' })
      
      // Destroy should not throw
      assert.doesNotThrow(() => {
        destroyPlayer()
      })
    })

    it('should handle no active player gracefully', () => {
      destroyPlayer() // First call clears any existing
      
      assert.doesNotThrow(() => {
        destroyPlayer()
      })
    })
  })

  describe('seekTo', () => {
    it('should call seekTo on player', () => {
      let calledWith: any[] = []
      const player = { seekTo: (...args: any[]) => { calledWith = args } } as unknown as YT.Player

      seekTo(player, 45)

      assert.deepStrictEqual(calledWith, [45, true])
    })
  })

  describe('setVolume', () => {
    it('should set volume within valid range', () => {
      const calls: number[] = []
      const player = { setVolume: (v: number) => { calls.push(v) } } as unknown as YT.Player

      setVolume(player, 75)
      assert.deepStrictEqual(calls[0], 75)

      setVolume(player, 150) // Should clamp to 100
      assert.deepStrictEqual(calls[1], 100)

      setVolume(player, -10) // Should clamp to 0
      assert.deepStrictEqual(calls[2], 0)
    })
  })

  describe('nextVideo / previousVideo', () => {
    it('should call nextVideo on player', () => {
      let called = false
      const player = { nextVideo: () => { called = true } } as unknown as YT.Player

      nextVideo(player)

      assert.strictEqual(called, true)
    })

    it('should call previousVideo on player', () => {
      let called = false
      const player = { previousVideo: () => { called = true } } as unknown as YT.Player

      previousVideo(player)

      assert.strictEqual(called, true)
    })
  })

  describe('getHandoffState', () => {
    it('should return null if no state exists', () => {
      const result = getHandoffState()
      assert.strictEqual(result, null)
    })

    it('should return null if state is stale (>30s)', () => {
      const staleState = {
        videoId: 'old',
        trackTitle: 'Old Song',
        trackAuthor: 'Old Artist',
        position: 0,
        duration: 100,
        playing: true,
        playlistIndex: 0,
        volume: 50,
        timestamp: Date.now() - 31_000, // 31 seconds ago
      }

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(staleState))
      const result = getHandoffState()
      assert.strictEqual(result, null)
    })

    it('should return state if recent (<30s)', () => {
      const freshState = {
        videoId: 'fresh',
        trackTitle: 'Fresh Song',
        trackAuthor: 'Fresh Artist',
        position: 30,
        duration: 200,
        playing: true,
        playlistIndex: 1,
        volume: 60,
        timestamp: Date.now() - 5_000, // 5 seconds ago
      }

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(freshState))
      const result = getHandoffState()
      assert.deepStrictEqual(result, freshState)
    })
  })

  describe('waitForYouTubeApi', () => {
    it('should resolve immediately if API is ready', async () => {
      await assert.doesNotReject(async () => {
        await waitForYouTubeApi()
      })
    })

    it('should reject on timeout if API never loads', async () => {
      const originalYT = window.YT
      // @ts-ignore
      window.YT = undefined

      await assert.rejects(
        async () => await waitForYouTubeApi(100),
        /timeout/
      )

      window.YT = originalYT
    })
  })
})

// Integration test for the critical synchronous playVideo requirement
describe('Critical Requirements', () => {
  it('playVideo must be callable synchronously in click handlers', () => {
    let called = false
    const player = { playVideo: () => { called = true } } as unknown as YT.Player

    // Simulate click handler - must be able to call playVideo synchronously
    function handleClick() {
      playVideo(player) // This MUST NOT return a Promise or use async/await
    }

    // Should complete synchronously
    handleClick()
    
    assert.strictEqual(called, true)
    
    // Verify no Promise was involved
    const result = playVideo(player)
    assert.strictEqual(result, undefined) // void return, not Promise
  })

  it('session state format matches YouTubePlayer.tsx expectations', () => {
    const state = {
      videoId: 'test123',
      trackTitle: 'Test Title',
      trackAuthor: 'Test Author',
      position: 45.5,
      duration: 180,
      playing: true,
      playlistIndex: 2,
      volume: 75,
      timestamp: Date.now(),
    }

    saveStateToSession(state)
    const loaded = loadStateFromSession()

    // Verify all required fields exist
    assert.ok(loaded, 'State should load')
    assert.ok('videoId' in loaded!)
    assert.ok('trackTitle' in loaded!)
    assert.ok('trackAuthor' in loaded!)
    assert.ok('position' in loaded!)
    assert.ok('duration' in loaded!)
    assert.ok('playing' in loaded!)
    assert.ok('playlistIndex' in loaded!)
    assert.ok('volume' in loaded!)
    assert.ok('timestamp' in loaded!)
  })
})
