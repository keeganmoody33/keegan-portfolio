# Turntable Loading Page Implementation

## Overview
React Three Fiber implementation of the interactive SL-1200 style turntable loading page.

## Features
- 3D turntable with base, spinning platter, and interactive tonearm
- Hover magnify effect to invite click
- Click tonearm → drops to vinyl edge → synchronous audio start
- "Lost signal" TV static transition to portfolio
- Skip button: "I don't like music"
- Return visitor bypass via localStorage
- prefers-reduced-motion support
- Audio state handoff via sessionStorage

## File Structure
```
app/loading/page.tsx          # Main loading page (UI, YouTube, dynamic import)
app/loading/TurntableCanvas.tsx  # R3F scene (client-only, no SSR)
hooks/useAudioHandoff.ts      # Audio state restoration hook (optional)
```

## Next.js / React 19 compatibility
- The 3D scene is loaded with `next/dynamic(..., { ssr: false })` so Canvas never runs during SSR and avoids "Expression not available" / message channel errors with React 19.
- All R3F/Three code lives in `TurntableCanvas.tsx`; the main page stays free of R3F imports.

## Technical Details

### 3D Scene
- Base: BoxGeometry (4.5 x 0.3 x 3.5)
- Platter: CylinderGeometry (radius 1.7), spins when playing
- Tonearm: BoxGeometry with pivot group, animates on click
- Needle: ConeGeometry, positioned at headshell

### Interaction Flow
1. Page loads → 3D turntable renders
2. User hovers → subtle scale (1.02x) magnify
3. User clicks tonearm → SYNCHRONOUS playVideo() call
4. Tonearm animates down to record edge (0.35 rad rotation)
5. 2 second delay → "lost signal" static transition
6. Navigate to portfolio with audio continuing

### Audio Integration
- YouTube IFrame API with playlist PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk
- Hidden player, no controls
- Synchronous play() within click handler (required for Safari)
- sessionStorage key `yt-player-state` (same as YouTubePlayer.tsx) for handoff; state shape: videoId, trackTitle, trackAuthor, position, duration, playing, playlistIndex, volume, timestamp

### Transition Effect
- Framer Motion AnimatePresence
- CSS repeating-linear-gradient for static noise
- Animated scanlines
- Opacity flicker (0.3-0.8)
- 1.5 second duration

### Accessibility
- prefers-reduced-motion: Direct to portfolio, no 3D
- Skip button always available after 3 seconds
- Clear instruction text

## Performance
- React Three Fiber with drei for optimized 3D
- Shadows enabled
- Environment preset for studio lighting
- ~350KB bundle (R3F + drei + framer-motion)

## Dependencies
- @react-three/fiber
- @react-three/drei
- framer-motion
- three

## Notes
- Tonearm click target is invisible larger box for better UX
- Tonearm rotation: 0 → 0.35 radians (toward record edge)
- Platter rotation: continuous when isPlaying
- Static transition mimics cable disconnect / TV static

## Testing checklist

1. **First visit**
   - Open http://localhost:3000/loading (or clear `localStorage.hasVisitedPortfolio` and go to /loading).
   - Expect: 3D turntable, “Click the tonearm to start”, then after ~3s “I don't like music” skip.
   - Hover: scene subtly zooms (1.02x).
   - Click tonearm: music starts immediately, tonearm animates to record edge, platter spins.

2. **Transition**
   - ~2s after needle drop: “lost signal” static overlay.
   - ~1.5s later: navigate to `/`.
   - Expect: portfolio loads and banner YouTube player resumes from same position (handoff via `yt-player-state`).

3. **Return visit**
   - With `hasVisitedPortfolio` in localStorage, visit /loading again.
   - Expect: redirect to `/` (no turntable).

4. **Skip**
   - On first visit, wait for skip button, click “I don't like music”.
   - Expect: go to `/` with no music.

5. **Reduced motion**
   - Enable OS “Reduce motion” (or emulate in DevTools), then open /loading.
   - Expect: simple “Enter Portfolio” button, no 3D.
