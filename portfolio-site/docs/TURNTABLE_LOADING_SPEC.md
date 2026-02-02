# Turntable Loading Page — Feature Spec

**Status:** Scoping
**Created:** Feb 1, 2026
**Priority:** Critical (entry point, first impression)

---

## Overview

The turntable loading page is the entry experience before the portfolio. A vinyl record on a turntable with a tonearm — the needle drop is the disguised "proceed to portfolio" action. Music starts playing and persists into the banner player.

**Why YouTube over Tidal:**
- Tidal requires subscription for full playback
- YouTube embeds are free, ubiquitous, and reliable
- Can still curate specific tracks/playlists

---

## Core Interaction Flow

```
[User lands on site]
         ↓
[Turntable loads — record spinning]
         ↓
[Tonearm is lifted, waiting]
         ↓
[User clicks/drags tonearm to drop needle]
         ↓
[Music starts playing (YouTube embed)]
         ↓
[Transition animation to portfolio]
         ↓
[Music continues in banner player]
         ↓
[Portfolio loads with persistent audio]
```

---

## Visual Design

### Aesthetic
- **Black and white** primary palette
- Clean, minimal, high contrast
- Vinyl record texture and grooves
- Tonearm with realistic pivot mechanics
- **Tool:** Unicorn Studio for visual effects/animations

### Elements
| Element | Description |
|---------|-------------|
| Record | Black vinyl with label art (could be custom) |
| Platter | Silver/chrome turntable platter, spinning |
| Tonearm | Realistic pivot, follows groove path |
| Needle | Highlight on contact point |
| Background | Dark/black, minimal distraction |

### Animation States
| State | Description | Duration |
|-------|-------------|----------|
| Idle | Record spinning, tonearm lifted | Continuous |
| Hover | Tonearm highlights, cursor changes | Instant |
| Drop | Tonearm pivots down, needle contacts | 0.6-1s ease |
| Playing | Subtle groove tracking, maybe dust particles | Continuous |
| Transition | Zoom into record or fade to portfolio | 0.8-1.2s |

---

## Audio Architecture

### YouTube Integration
```javascript
// YouTube IFrame API
const player = new YT.Player('player', {
  videoId: 'TRACK_ID',
  playerVars: {
    autoplay: 0,        // Wait for needle drop
    controls: 0,        // Hidden controls
    disablekb: 1,       // No keyboard shortcuts
    fs: 0,              // No fullscreen
    modestbranding: 1,  // Minimal YouTube branding
    rel: 0,             // No related videos
    showinfo: 0         // No video info
  },
  events: {
    onReady: onPlayerReady,
    onStateChange: onPlayerStateChange
  }
});
```

### State Handoff to Banner
```javascript
// On transition to portfolio
const audioState = {
  videoId: currentVideoId,
  currentTime: player.getCurrentTime(),
  isPlaying: true,
  volume: player.getVolume()
};

// Store in sessionStorage for banner pickup
sessionStorage.setItem('audioState', JSON.stringify(audioState));

// Banner player reads this on mount
```

---

## Technical Implementation

### Component Hierarchy
```
<TurntableLoader>
  ├── <Turntable>
  │   ├── <Platter />        // Spinning animation
  │   ├── <Record />         // Vinyl with label
  │   └── <Tonearm />        // Interactive pivot
  ├── <YouTubePlayer />      // Hidden iframe
  └── <TransitionOverlay />  // Portfolio reveal
</TurntableLoader>
```

### Interaction Logic
```javascript
// Tonearm interaction
const [needleDropped, setNeedleDropped] = useState(false);
const [isTransitioning, setIsTransitioning] = useState(false);

const handleNeedleDrop = () => {
  if (needleDropped) return;

  setNeedleDropped(true);
  player.playVideo();

  // Small delay before transition
  setTimeout(() => {
    setIsTransitioning(true);

    // Navigate after animation
    setTimeout(() => {
      router.push('/portfolio');
    }, 1000);
  }, 1500); // Let music establish first
};
```

### Skip Option
```javascript
// Subtle skip for returning visitors or accessibility
<button
  className="absolute bottom-4 right-4 text-xs text-gray-500 hover:text-white"
  onClick={() => router.push('/portfolio')}
>
  Skip intro →
</button>
```

---

## Banner Player Integration

### Persistent Player Component
```javascript
// In layout or app wrapper
const BannerPlayer = () => {
  const [audioState, setAudioState] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('audioState');
    if (stored) {
      setAudioState(JSON.parse(stored));
    }
  }, []);

  if (!audioState) return null;

  return (
    <div className="banner-player">
      <YouTubePlayer
        videoId={audioState.videoId}
        startSeconds={audioState.currentTime}
        autoplay={audioState.isPlaying}
      />
      <TrackInfo />
      <PlayPauseButton />
    </div>
  );
};
```

### Banner Layout Reference
```
┌─────────────────────────────────────────────────────────────┐
│  [▶] Track Name - Artist                    [YouTube logo]  │
│  ───────────────────○────────────────────── 2:34 / 4:12    │
└─────────────────────────────────────────────────────────────┘
```

---

## Track Curation

### Options
1. **Single curated track** — Same song every time
2. **Rotating playlist** — Random from curated list
3. **User's choice** — Let them pick before needle drop

### Track Criteria
- Sets the vibe (matches portfolio energy)
- Instrumental or clean lyrics
- Good intro (first 10 seconds matter)
- Copyright-safe for playback

### Playlist Strategy

**Approach:** Public YouTube playlist
- You curate a public playlist on YouTube
- We pull video IDs from the playlist via YouTube Data API
- Random track selected on each visit (or sequential)
- You can update tracks anytime without touching code

**YouTube Playlist API:**
```javascript
const PLAYLIST_ID = 'PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk';

async function getPlaylistTracks() {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?` +
    `part=snippet&playlistId=${PLAYLIST_ID}&maxResults=50&key=${API_KEY}`
  );
  const data = await res.json();
  return data.items.map(item => ({
    videoId: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    artist: extractArtist(item.snippet.title)  // Parse from title
  }));
}
```

**Waiting on:** Public playlist URL from you

---

## Accessibility

### Requirements
- Skip button always visible (not just on hover)
- Keyboard accessible needle drop (Enter/Space)
- Screen reader: "Press Enter to start music and enter portfolio"
- Reduced motion: Skip animation, go straight to portfolio
- Respect `prefers-reduced-motion` media query

### Implementation
```javascript
// Reduced motion support
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

if (prefersReducedMotion) {
  return <SkipToPortfolio />;
}
```

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Initial load | < 2s |
| Time to interactive | < 1.5s |
| YouTube iframe load | Lazy, after turntable renders |
| Transition smoothness | 60fps |

### Optimization Strategy
- Preload portfolio assets during turntable interaction
- YouTube player loads in background (not blocking)
- Turntable assets optimized (SVG where possible, compressed PNG/WebP)
- CSS animations over JS where possible

---

## Done Criteria

- [ ] Turntable renders with spinning record
- [ ] Tonearm is interactive (hover state, click/drag)
- [ ] Needle drop triggers YouTube playback
- [ ] Music plays with no visible YouTube UI
- [ ] Transition animation to portfolio is smooth
- [ ] Music continues in banner player after transition
- [ ] Skip button works for accessibility
- [ ] Reduced motion preference respected
- [ ] Mobile: Touch interaction works for needle drop
- [ ] Performance targets met

---

## Open Questions

1. ~~**Track selection:**~~ ✅ Playlist: `PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk`
2. **Label art:** Custom design or placeholder?
3. **Skip behavior:** Immediate skip or brief animation?
4. **Return visitors:** Show turntable every time or remember?
5. **Mobile:** Same experience or simplified version?

---

## Dependencies

- YouTube IFrame API integration
- Turntable visual assets (record, platter, tonearm)
- Banner player component
- Session storage for audio state handoff
- Transition animation system

---

## Related Features

| Feature | Relation |
|---------|----------|
| Banner widgets | Music player persistence lives here |
| Alan Iverson | Both are "intro experiences" before main content |
| Theme/vibe | Turntable sets the aesthetic tone |

---

*Spec v1.0 — Feb 1, 2026*
