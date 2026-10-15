# Brand preview sizing verification

2026-10-15 · America/New_York

Requested changes: less space around both logo previews; a larger mark-and-name preview.

- Both marks render at 192 × 192 CSS px, up from 128 × 128.
- Preview padding is 24px, down from 48px; the fixed minimum stage height is removed.
- Horizontal lockup maximum width is 720px, up from 360px; vertical padding is 24px.
- Canonical SVG/PNG files are unchanged.

## Browser checks

Local Next development build at http://127.0.0.1:3106/brand. No horizontal overflow at any tested viewport.

| Viewport | Mark width | Lockup width | Result |
| --- | --- | --- | --- |
| 320px | 192px | 216px | Fits, proportional |
| 390px | 192px | 286px | Fits, proportional |
| 992px | 192px | 720px | Fits, proportional |
| 1440px | 192px | 720px | Fits, proportional |

The logos and mark + name anchors were exercised. Both logo assets loaded. Desktop and mobile screenshots are adjacent to this file. `git diff --check` passed.

The earlier full usability suite (601 tests, lint, typecheck, production build) passed at 757cb7483efccd047e47cb27ce5d133956889fbe. This follow-up changes CSS presentation only; it does not claim a rerun of that suite. The hosted preview build is checked separately after push.

Paper explorations are separate design artifacts. No proposed portfolio recoloring, founder photography, playback integration, or payment flow is implemented by this change.
