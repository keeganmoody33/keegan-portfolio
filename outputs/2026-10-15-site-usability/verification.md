# lecturesfrom website usability verification

2026-10-15 · America/New_York

Review base: `brand/v2-kit`, `12c29e74d60ea2ea2adc808661540a295f65df56` (PR #82, open when checked).
Working branch: `codex/site-usability-20261015`.

## Automated checks

- `npm test`: 601 passed, 0 failed, 122 suites.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed with placeholder Supabase configuration and Redis variables unset.
- `git diff --check`: passed.
- Tests include accent/case normalization, multi-field matching, all-term matching, empty query, unknown year, and stable collection ordering.
- Existing disclosure/consent, stored-record, research, asset, and hardware tests remain in the suite. Copy-sensitive assertions were adjusted for the new wording and 48px reserved hardware control row.

## Browser checks

Local production build at `http://127.0.0.1:3105` in the Codex browser.

- All ten main routes at 320 CSS px: home, catalog, three project pages, collection, doingflips, brand, company/credits, and personal page. No horizontal overflow or right-clipped main controls. Raw measurements: `mobile-layout-checks.json`.
- Desktop home: visible navigation and explicit explore/contact actions. Explore jumps to the catalog with a 24px margin.
- 390px software project: title, description, status, and project-links action appear before the cover.
- Collection: 279 public records. Searching `bootsy` returns two. Shuffle retains the filter. Opening Bootsy 573292 shows the record overlay, isolates the background navigation, exposes overview/tracks, and links a selected track to its encoded flip URL. Escape closes track details, then the overlay; focus returns to the originating record and the query remains. A nonmatching search shows zero results and clear-search recovery.
- Doingflips local fixtures: explicit multi-match selection, search results remain open after clicking find song, selected song identity, collapsed optional sample history, empty-contact validation, required SMS consent, and success copy. Success was a fixture, not a real request. No real email/SMS was sent.
- Personal page: separate Projects and Role fit destinations. Placeholder Supabase produces career recovery with Retry and LinkedIn. The modal is a native dialog; Shift+Tab and Tab wrap at its boundaries, Escape closes it, and focus returns to its opener. Chat and role comparison display useful errors and preserve input after local backend failures.
- Reduced motion: doingflips animation is `none`. All eleven name characters have opacity `1` and animation `none`; whole-word name is accessible. Name remains visible after disabling JavaScript and reloading. Browser overrides restored afterward.
- Light brand page: background rgb(255,255,255), text rgb(10,10,10), no horizontal overflow, navigation and buttons remain visible.
- Yadiggg: study-first order retained; reference mode switches successfully; camera controls measure 44 CSS px with room reserved in the layout.
- Brand files: all 30 distinct download links returned HTTP 200 and exact bytes matching public assets; all 9 section anchors target existing IDs; archive contains 45 files and passed zip integrity. See `download-checks.json`. Full-kit native download and keyboard section navigation were also checked.

## Scope of evidence

The local build used `https://example.supabase.co` and a placeholder anon key. Successful live career loading, AI answers, and role comparisons were not verified. Error recovery was verified. Record research fixtures were identified as fixtures; no research backfill or production storage mutation was run. No production merge or deployment was performed. The existing dirty Documents checkout and first recovery copies were preserved.

Screenshots in this directory are local review evidence. `flip-*` screenshots use local fixtures. `chat-recovery-390.jpg` intentionally shows a local backend failure. `keegan-desktop.jpg` was captured with reduced motion enabled.
