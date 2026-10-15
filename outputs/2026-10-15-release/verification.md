# Merge verification · 2026-10-15

Keegan authorized merging the approved website work. PR #83 targets the #82 brand-kit branch; #82 targets main.

## Review disposition

- #83 keyboard result visibility: reproduced on b9e1d11. ArrowUp from the first result selected the eighth result with scrollTop 0; the active result bottom was 1003.84px while the list bottom was 734.84px. The fix scrolls the active option into view after React commits it. The same case now has scrollTop 270 and active bottom 733.84px, with focus still on flip-lookup.
- ArrowUp/ArrowDown and wrapping remain visible at 390px and 1440px. Enter on the first result selects Voices Inside (Everything Is Everything), Donny Hathaway, 1970. Local fixture only; no request submission.
- #82 manifest archive finding: lf-brand-kit/manifest.json exists inside public/brand/kit/lf-brand-kit.zip and is byte-identical to public/brand/manifest.json.
- #82 favicon regeneration finding: scripts/brand/render.py builds the white circular plate for ICO/PNG; adaptive SVG remains separate. Already fixed in 53adb00, inherited by this branch.

## Checks

`npm test`: 606 passed, zero failed. `npm run typecheck`, `npm run lint`, and production build passed. Build uses local Supabase placeholders; successful backend delivery is not inferred.

See keyboard-result-visibility.json and keyboard-selection-mobile.png for the reproduced/fixed UI evidence. Exact merge commits, deployment checks, and live-site acceptance are recorded in the task Ref after the release.
