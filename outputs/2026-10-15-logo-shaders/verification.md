# Logo shader exploration verification

Date: 2026-10-15 (America/New_York)
Branch: `codex/site-usability-20261015`, PR #83.

## Implemented

- `/brand/motion`: chrome, molten, pearl, ember, thermal, and ice; black/navy/white backgrounds; scale 60–110%; speed 0.10–1.00; play/pause.
- Homepage silver/heat/room comparison, plus playground links from home and brand kit.
- Official Paper Shaders core 0.0.81, one lazy canvas, 700,000-pixel budget, source-processing cache, disposal, original SVG fallback, reduced motion, offscreen/tab visibility suspension.
- Canonical assets and product identity geometry unchanged. These are preview experiments, not an approved final palette.

## Local evidence

- `npm test`: 606 passed, 0 failed.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed. Build used placeholder Supabase configuration.
- All six treatments and three backgrounds: 18 combinations rendered one canvas, no horizontal overflow. See `combination-checks.json`.
- Production build at 320, 390, 768, 1440 CSS px: no horizontal overflow. The initial 320px snapshot in `responsive-checks.json` was taken during deferred loading; a follow-up waited for `data-ready=true` and verified ember rendered at 320px.
- Keyboard End adjusted scale to 110%; ArrowRight adjusted speed from 0.22 to 0.24. Paused frame remained exactly 19188.80399999696 across those changes.
- Fresh no-preference load advanced the frame from 8000 to 9256.463999997484. Reduced-motion preference starts paused; explicit play remains available.
- Homepage workbench navigation left the canvas offscreen: `inView=false`, `currentSpeed=0`. Selecting room left zero canvases and the founder photo.
- Forced context loss removed the canvas, showed the original mark and explanatory caption, and disabled motion. Simulated initial WebGL2 unavailability also kept the static mark. Both simulations were local and restored before reload.
- Development hot replacement briefly produced stale props/observer state; fresh production loading is the acceptance surface. Use localhost in development because Next rejects unconfigured 127.0.0.1 resource origins.

## Screenshots

- `chrome-desktop.png`: production build, chrome on black.
- `thermal-desktop.png`: production build, thermal on navy.
- `ice-mobile.png`: production build, ice on white at 390px.

## Hosted verification

Pending this commit's preview deployment. No production promotion or merge.
