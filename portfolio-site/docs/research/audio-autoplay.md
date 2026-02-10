# Browser Autoplay Policies and Audio Play Event Strategies

> Research document on browser autoplay restrictions, User Activation API, and strategies for initiating audio from 3D interactions.
> Date: February 10, 2026

## Executive Summary

This document analyzes browser autoplay policies and provides implementation patterns for the turntable loading page's audio handoff. The core challenge: ensuring the 3D turntable's needle-drop interaction qualifies as a user gesture that unlocks audio playback across all major browsers.

**Key Finding:** The needle drop interaction on the 3D turntable naturally satisfies user activation requirements because it requires a click/tap. The critical implementation detail is ensuring the YouTube player's `playVideo()` call occurs synchronously within the same event handler as the 3D interaction.

---

## Browser Autoplay Policy Overview (2024/2025)

### Chrome (Chromium)

| Attribute | Details |
|-----------|---------|
| **Policy Version** | Autoplay Policy v2.0 (stable since Chrome 66, refined through Chrome 120+) |
| **Blocking Behavior** | Blocks autoplay with sound until user interacts with domain |
| **MEI (Media Engagement Index)** | Tracks user media consumption per site; high MEI = autoplay allowed |
| **Gesture Requirement** | Single user gesture unlocks audio for current browsing session |
| **Documentation** | https://developer.chrome.com/blog/autoplay/ |

**Policy Rules:**
1. Autoplay with sound is blocked unless:
   - User has interacted with the site (click, tap, key press)
   - Site has high Media Engagement Index (returning visitors)
   - Site is pinned to home screen (mobile PWA)
   - User has previously allowed autoplay in site settings

2. Muted autoplay is always allowed

3. User gesture must be "consumption-triggered" — programmatic `.play()` calls deferred with `setTimeout` or Promise chains may lose activation context

---

### Safari (WebKit)

| Attribute | Details |
|-----------|---------|
| **Policy Version** | Intelligent Tracking Prevention + Autoplay Policy (iOS 17+, macOS Sonoma+) |
| **Blocking Behavior** | Strictest autoplay policy; requires user gesture per page load |
| **MEI Equivalent** | None — each page load requires fresh user activation |
| **Gesture Requirement** | Explicit user gesture (click, tap, keydown) must directly trigger playback |
| **Documentation** | https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/ |

**Policy Rules:**
1. No autoplay with sound under any circumstances without user gesture
2. Gesture must be synchronous with `play()` call — no asynchronous gaps
3. `AudioContext` requires `resume()` after user gesture
4. Private browsing mode is even more restrictive

**Critical Safari Constraint:**
```javascript
// ❌ BROKEN in Safari: play() called in Promise chain
button.addEventListener('click', () => {
  fetchAudio().then(() => player.playVideo()); // Too late!
});

// ✅ WORKS in Safari: play() called synchronously
button.addEventListener('click', () => {
  player.playVideo(); // Immediate execution
});
```

---

### Firefox (Gecko)

| Attribute | Details |
|-----------|---------|
| **Policy Version** | Autoplay Policy (Firefox 66+, refined through Firefox 120+) |
| **Blocking Behavior** | Blocks autoplay with sound; user preference-based |
| **Gesture Requirement** | User interaction unlocks autoplay for session |
| **Special Behavior** | Respects `media.autoplay.default` user preference (0=allow, 1=block, 2=prompt) |
| **Documentation** | https://support.mozilla.org/en-US/kb/block-autoplay |

**Policy Rules:**
1. Default: block autoplay with sound
2. User can override per-site via address bar icon
3. User gesture unlocks audio for domain
4. Less strict than Safari about asynchronous play() calls, but synchronous is still recommended

---

## Browser Compatibility Matrix

| Feature | Chrome 120+ | Safari 17+ | Firefox 120+ | Notes |
|---------|-------------|------------|--------------|-------|
| Autoplay blocking | ✅ Yes | ✅ Yes | ✅ Yes | All block by default |
| User gesture unlocks | ✅ Yes | ✅ Yes | ✅ Yes | Universal requirement |
| MEI bypass | ✅ Yes | ❌ No | ⚠️ Partial | Chrome-only benefit |
| Async play() allowed | ⚠️ Sometimes | ❌ No | ✅ Usually | Safari is strictest |
| AudioContext resume() | ✅ Required | ✅ Required | ✅ Required | All require explicit resume |
| PWA home screen boost | ✅ Yes | ✅ Yes | ❌ No | iOS/Android PWA advantage |

**Key Insight:** Safari is the most restrictive browser. If your implementation works in Safari, it will work everywhere.

---

## User Activation API

### What Qualifies as User Activation?

Per W3C spec, the following events constitute user activation:

| Event Type | Activation | Notes |
|------------|------------|-------|
| `click` | ✅ Yes | Primary interaction for turntable |
| `keydown` | ✅ Yes | Accessibility fallback |
| `touchstart` / `touchend` | ✅ Yes | Mobile equivalent of click |
| `pointerdown` / `pointerup` | ✅ Yes | Unified pointer events |
| `mousedown` / `mouseup` | ✅ Yes | Legacy mouse events |
| `mousemove` | ❌ No | Not an intentional gesture |
| `scroll` | ❌ No | Not an intentional gesture |
| `load` / `DOMContentLoaded` | ❌ No | Page lifecycle, not user gesture |

### Activation Expiration

User activation is **consumable** and **time-bound**:

```javascript
// Chrome: Activation lasts for ~5 seconds or until consumed
// Safari: Activation is per-event, must trigger play() synchronously
// Firefox: Similar to Chrome, ~5 second window
```

### navigator.userActivation API (Experimental)

```javascript
// Check if user has activated the page (Chromium only)
if (navigator.userActivation?.isActive) {
  // User has interacted recently
}

// Check if user has ever activated (higher trust)
if (navigator.userActivation?.hasBeenActive) {
  // User has interacted with this domain before
}
```

**Browser Support:** Chrome/Edge only. Not available in Safari or Firefox.

---

## YouTube IFrame API Integration with Autoplay

### Standard YouTube Player Setup

```typescript
// YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: YTPlayerOptions
      ) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  getVolume(): number;
  destroy(): void;
}

// Player configuration for hidden embed
const playerConfig = {
  videoId: 'VIDEO_ID',
  playerVars: {
    autoplay: 0,        // Must be 0 — we trigger manually
    controls: 0,        // Hide controls
    disablekb: 1,       // No keyboard shortcuts
    fs: 0,              // No fullscreen
    modestbranding: 1,  // Minimal YouTube branding
    rel: 0,             // No related videos
    showinfo: 0,        // No video info (deprecated but harmless)
    mute: 0,            // Start unmuted (will be blocked until gesture)
    playsinline: 1,     // iOS: play inline, not fullscreen
  },
  events: {
    onReady: onPlayerReady,
    onStateChange: onPlayerStateChange,
    onError: onPlayerError,
  },
};
```

### The Synchronous Play Pattern

```typescript
// ❌ BROKEN: Asynchronous gap breaks user activation
function handleNeedleDropBroken() {
  // Animation first...
  animateTonearm().then(() => {
    // Too late! User activation expired
    player.playVideo(); // DOMException: play() failed
  });
}

// ✅ WORKING: Synchronous play, then animation
function handleNeedleDropWorking() {
  // Play IMMEDIATELY while activation is valid
  player.playVideo();
  
  // Then start animation (non-blocking)
  animateTonearm();
  
  // Then transition
  transitionToPortfolio();
}

// ✅ WORKING: With error handling for blocked autoplay
async function handleNeedleDropRobust() {
  try {
    // Attempt to play synchronously
    player.playVideo();
    
    // Check if actually playing after short delay
    setTimeout(() => {
      const state = player.getPlayerState();
      if (state !== window.YT.PlayerState.PLAYING) {
        // Autoplay was blocked, show unblock UI
        showAudioUnblockPrompt();
      }
    }, 500);
    
    animateTonearm();
    transitionToPortfolio();
  } catch (error) {
    console.error('Playback failed:', error);
    showAudioUnblockPrompt();
  }
}
```

---

## AudioContext Suspension/Resumption

For advanced audio handling (if using Web Audio API alongside YouTube):

```typescript
// AudioContext state management
class AudioContextManager {
  private context: AudioContext | null = null;
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.context = new (window.AudioContext || 
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
  }
  
  // Must be called from user gesture handler
  async resume(): Promise<boolean> {
    if (!this.context) return false;
    
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    
    return this.context.state === 'running';
  }
  
  // Check state without changing it
  get isSuspended(): boolean {
    return this.context?.state === 'suspended';
  }
  
  // Synchronous check for gesture handlers
  ensureRunning(): void {
    if (this.context?.state === 'suspended') {
      // Fire-and-forget resume attempt
      this.context.resume().catch(console.error);
    }
  }
}

// Usage with turntable interaction
const audioManager = new AudioContextManager();

function handleNeedleDrop() {
  // Resume AudioContext (required in Safari)
  audioManager.ensureRunning();
  
  // Start YouTube playback
  player.playVideo();
  
  // Continue with transition...
}
```

---

## State Management for Audio Handoff

### Session Storage Pattern

```typescript
interface AudioState {
  videoId: string;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  timestamp: number; // For expiration check
}

const AUDIO_STATE_KEY = 'portfolio_audio_state';
const STATE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Save state when leaving loading page
function saveAudioState(player: YTPlayer, videoId: string): void {
  const state: AudioState = {
    videoId,
    currentTime: player.getCurrentTime(),
    isPlaying: true,
    volume: player.getVolume(),
    timestamp: Date.now(),
  };
  
  sessionStorage.setItem(AUDIO_STATE_KEY, JSON.stringify(state));
}

// Restore state on portfolio page
function restoreAudioState(): AudioState | null {
  const stored = sessionStorage.getItem(AUDIO_STATE_KEY);
  if (!stored) return null;
  
  try {
    const state: AudioState = JSON.parse(stored);
    
    // Check expiration
    if (Date.now() - state.timestamp > STATE_EXPIRY_MS) {
      sessionStorage.removeItem(AUDIO_STATE_KEY);
      return null;
    }
    
    return state;
  } catch {
    sessionStorage.removeItem(AUDIO_STATE_KEY);
    return null;
  }
}

// Clear state when appropriate
function clearAudioState(): void {
  sessionStorage.removeItem(AUDIO_STATE_KEY);
}
```

### React Hook for Banner Player

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';

interface UseAudioHandoffResult {
  audioState: AudioState | null;
  isResuming: boolean;
  error: Error | null;
  retry: () => void;
}

export function useAudioHandoff(): UseAudioHandoffResult {
  const [audioState, setAudioState] = useState<AudioState | null>(null);
  const [isResuming, setIsResuming] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const loadState = useCallback(() => {
    setIsResuming(true);
    setError(null);
    
    try {
      const state = restoreAudioState();
      setAudioState(state);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to restore audio'));
    } finally {
      setIsResuming(false);
    }
  }, []);
  
  useEffect(() => {
    loadState();
  }, [loadState]);
  
  return {
    audioState,
    isResuming,
    error,
    retry: loadState,
  };
}

// Usage in banner player
function BannerPlayer() {
  const { audioState, isResuming } = useAudioHandoff();
  
  if (isResuming) {
    return <BannerPlayerSkeleton />;
  }
  
  if (!audioState) {
    return <DefaultBannerPlayer />;
  }
  
  return (
    <YouTubePlayer
      videoId={audioState.videoId}
      startSeconds={audioState.currentTime}
      autoplay={audioState.isPlaying}
      initialVolume={audioState.volume}
    />
  );
}
```

---

## Error Handling for Blocked Autoplay

### Detection Strategy

```typescript
interface AutoplayStatus {
  canAutoplay: boolean;
  reason?: 'blocked' | 'muted' | 'error';
  error?: Error;
}

async function detectAutoplayStatus(player: YTPlayer): Promise<AutoplayStatus> {
  return new Promise((resolve) => {
    // Set a timeout for detection
    const timeout = setTimeout(() => {
      const state = player.getPlayerState();
      
      if (state === window.YT.PlayerState.PLAYING) {
        resolve({ canAutoplay: true });
      } else {
        resolve({ 
          canAutoplay: false, 
          reason: 'blocked',
        });
      }
    }, 1000);
    
    // Also listen for error events
    const originalOnError = player.onError;
    player.onError = (error: unknown) => {
      clearTimeout(timeout);
      resolve({
        canAutoplay: false,
        reason: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      if (originalOnError) originalOnError(error);
    };
  });
}
```

### Fallback UX for Blocked Audio

```typescript
interface AudioUnblockPromptProps {
  onRetry: () => void;
  onSkip: () => void;
}

function AudioUnblockPrompt({ onRetry, onSkip }: AudioUnblockPromptProps) {
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="text-center p-8 max-w-md">
        <h2 className="text-2xl font-bold mb-4">Enable Audio</h2>
        <p className="text-gray-300 mb-6">
          Your browser blocked audio playback. Click below to start the music 
          and enter the portfolio.
        </p>
        <div className="space-y-3">
          <button
            onClick={onRetry}
            className="w-full px-6 py-3 bg-white text-black font-medium rounded hover:bg-gray-200"
          >
            Start Music & Enter
          </button>
          <button
            onClick={onSkip}
            className="w-full px-6 py-3 border border-gray-600 text-gray-400 rounded hover:text-white hover:border-white"
          >
            Enter Without Audio
          </button>
        </div>
      </div>
    </div>
  );
}

// Integration with loading page
function TurntableLoader() {
  const [showUnblockPrompt, setShowUnblockPrompt] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  
  const handleNeedleDrop = async () => {
    const player = playerRef.current;
    if (!player) return;
    
    // Attempt synchronous play
    player.playVideo();
    
    // Check if it worked
    const status = await detectAutoplayStatus(player);
    
    if (status.canAutoplay) {
      // Success — proceed with transition
      saveAudioState(player, 'VIDEO_ID');
      transitionToPortfolio();
    } else {
      // Blocked — show unblock prompt
      setShowUnblockPrompt(true);
    }
  };
  
  const handleRetry = () => {
    setShowUnblockPrompt(false);
    // This click IS a user gesture, so play will work now
    playerRef.current?.playVideo();
    saveAudioState(playerRef.current!, 'VIDEO_ID');
    transitionToPortfolio();
  };
  
  return (
    <>
      <TurntableScene onNeedleDrop={handleNeedleDrop} />
      {showUnblockPrompt && (
        <AudioUnblockPrompt 
          onRetry={handleRetry}
          onSkip={transitionToPortfolio}
        />
      )}
    </>
  );
}
```

---

## Implementation Pattern: Gesture-to-Audio Flow

### Complete Working Example

```typescript
'use client';

import { useRef, useCallback, useState, useEffect } from 'react';

// Types
interface TurntableLoaderProps {
  videoId: string;
  onEnterPortfolio: () => void;
}

interface AudioState {
  videoId: string;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  timestamp: number;
}

// Constants
const AUDIO_STATE_KEY = 'portfolio_audio_state';
const STATE_EXPIRY_MS = 5 * 60 * 1000;
const PLAYER_CHECK_DELAY = 500;

export function TurntableLoader({ videoId, onEnterPortfolio }: TurntableLoaderProps) {
  const playerRef = useRef<YTPlayer | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Initialize YouTube player
  useEffect(() => {
    // Load YouTube IFrame API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    
    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('yt-player', {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => console.log('Player ready'),
          onError: (e) => console.error('Player error:', e),
        },
      });
    };
    
    return () => {
      playerRef.current?.destroy();
    };
  }, [videoId]);
  
  // Core interaction handler — MUST remain synchronous
  const handleNeedleDrop = useCallback(() => {
    const player = playerRef.current;
    if (!player || isTransitioning) return;
    
    // SYNCHRONOUS: Start playback immediately within user gesture
    player.playVideo();
    
    // Start transition animation
    setIsTransitioning(true);
    
    // Check if playback actually started
    setTimeout(() => {
      const state = player.getPlayerState();
      const isPlaying = state === window.YT.PlayerState.PLAYING;
      
      if (!isPlaying) {
        // Autoplay blocked — show unblock UI
        setIsBlocked(true);
        setIsTransitioning(false);
        return;
      }
      
      // Success — save state and proceed
      const audioState: AudioState = {
        videoId,
        currentTime: player.getCurrentTime(),
        isPlaying: true,
        volume: player.getVolume(),
        timestamp: Date.now(),
      };
      sessionStorage.setItem(AUDIO_STATE_KEY, JSON.stringify(audioState));
      
      // Navigate to portfolio
      onEnterPortfolio();
    }, PLAYER_CHECK_DELAY);
  }, [videoId, isTransitioning, onEnterPortfolio]);
  
  // Retry handler — called from unblock prompt (new user gesture)
  const handleRetry = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    
    // This click IS a user gesture, so play will work
    player.playVideo();
    setIsBlocked(false);
    
    // Save state
    const audioState: AudioState = {
      videoId,
      currentTime: player.getCurrentTime(),
      isPlaying: true,
      volume: player.getVolume(),
      timestamp: Date.now(),
    };
    sessionStorage.setItem(AUDIO_STATE_KEY, JSON.stringify(audioState));
    
    // Navigate
    onEnterPortfolio();
  }, [videoId, onEnterPortfolio]);
  
  return (
    <div className="relative w-full h-screen bg-black">
      {/* Hidden YouTube player */}
      <div id="yt-player" className="absolute opacity-0 pointer-events-none" />
      
      {/* 3D Turntable Scene */}
      <TurntableScene 
        onNeedleDrop={handleNeedleDrop}
        isTransitioning={isTransitioning}
      />
      
      {/* Autoplay Block Prompt */}
      {isBlocked && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-2xl font-bold mb-4">Enable Audio</h2>
            <p className="text-gray-300 mb-6">
              Click below to start the music and enter the portfolio.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full px-6 py-3 bg-white text-black font-medium rounded hover:bg-gray-200"
              >
                Start Music & Enter
              </button>
              <button
                onClick={onEnterPortfolio}
                className="w-full px-6 py-3 border border-gray-600 text-gray-400 rounded hover:text-white"
              >
                Enter Without Audio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Key Implementation Guidelines

### The Golden Rules

1. **Synchronous play()** — Call `player.playVideo()` directly in the event handler, never in a Promise chain or setTimeout

2. **Immediate check** — Verify playback started within 500ms; if not, assume blocked

3. **Graceful fallback** — Always provide an "Enter Without Audio" option

4. **State persistence** — Use `sessionStorage` (not `localStorage`) for audio handoff; it's per-tab and auto-cleans

5. **Test in Safari** — If it works in Safari, it works everywhere

### Anti-Patterns to Avoid

```typescript
// ❌ DON'T: Asynchronous play
async function handleClick() {
  await loadSomething();
  player.playVideo(); // Too late!
}

// ❌ DON'T: Deferred play
function handleClick() {
  setTimeout(() => {
    player.playVideo(); // User activation expired
  }, 100);
}

// ❌ DON'T: Event delegation without target check
document.addEventListener('click', () => {
  player.playVideo(); // May not count as user gesture
});

// ❌ DON'T: Programmatic trigger
document.getElementById('button')?.click(); // Synthetic event, no activation
```

### Recommended Patterns

```typescript
// ✅ DO: Direct event handler
<button onClick={() => player.playVideo()}>Play</button>

// ✅ DO: Ref to player, immediate call
const handleDrop = () => {
  playerRef.current?.playVideo(); // Immediate
};

// ✅ DO: Check state after short delay
playVideo();
setTimeout(() => {
  if (!isPlaying) showFallback();
}, 500);
```

---

## Summary

| Requirement | Solution |
|-------------|----------|
| User gesture unlocks audio | 3D turntable click → synchronous `playVideo()` |
| Cross-browser compatibility | Safari-first testing, synchronous pattern |
| YouTube IFrame API integration | Hidden player, manual play trigger |
| Audio handoff to banner | `sessionStorage` with expiry |
| Blocked autoplay handling | Detection + unblock prompt |
| prefers-reduced-motion | Skip turntable, show simple button |
| Return visitor optimization | `localStorage` check to skip loading page |

**Critical Success Factor:** The needle drop interaction on the 3D turntable counts as a user gesture. The implementation must call `player.playVideo()` synchronously within that interaction's event handler to satisfy browser autoplay policies.

---

*Document Version: 1.0*
*Author: Developer Agent*
*Date: February 10, 2026*
