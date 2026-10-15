# Headline motion verification · 2026-10-15

Requested changes: products → ideas → teams in the homepage headline; restore the jumping and turning flip in doingflips.

## Local production build

- TypeScript and ESLint passed.
- All 606 Node tests passed, zero failures.
- Production build passed with local Supabase URL/key placeholders. Initial unconfigured build failed on the existing missing Supabase URL. No backend success is inferred from the placeholder build.
- Measured a full word cycle at 200ms intervals: ideas → teams → products → ideas, approximately 2 seconds per word. The heading rectangle stayed identical across all 34 samples; see cadence.json.
- Real pause click held the current opacity and paused all word animations. Enter on the play control resumed. The workbench link scrolled away and paused the headline through IntersectionObserver.
- 320/390/850/1440 CSS-pixel layouts fit without horizontal overflow; see responsive-widths.json.
- Reduced motion: products opacity 1, other words 0, animation none, pause control hidden. Flip animation and transform both none.
- JavaScript disabled with no motion preference: server-rendered products remained visible, other words hidden, all animation play states paused, readiness false.
- Reused flipLand's 1.05-second one-shot clockwise jump. Sampled every 10ms with the browser animation debugger at all four widths. The full arc clears the eyebrow by at least 9.5px after proportional headroom; see flip-motion-bounds.json. Debug animation state was confined to the temporary local tab.
- Song combobox remains editable and its find-song control enabled. No contact/request submission was performed.

Desktop and mobile screenshots in this folder document the resulting layouts. Hosted verification is recorded in the linked Ref after deployment.
