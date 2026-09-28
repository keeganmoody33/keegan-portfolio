# App Flow — lecturesfrom.com Portfolio

**Last Updated:** 2026-09-28
**Framework:** Next.js (App Router)
**Deployment:** Vercel (auto-deploy on push to main)

---

## Route Inventory

### Pages

| Route            | File                         | What It Shows                                                   |
|------------------|------------------------------|-----------------------------------------------------------------|
| `/`              | `app/(house)/page.tsx`               | House title card + crate (Server Component). The last `o` in the wordmark `from` is a static filled `LogoMark` (PNG trace, provisional, to be replaced by the design-file spec; outlines `currentColor`; no `LogoGlobe`, no spin) at Chakra Petch x-height on the alphabetic baseline; there is no standalone coin above the wordmark. Wordmark (`HouseWordmark`, Chakra Petch) entrance is a 700ms opacity fade. HouseFooter does not render the Motion switch while the o is static; `MotionSwitch.tsx`, head bootstrap, and pause CSS stay in the repo. Nameplate and Hathaway SVGs are not mounted. No page turntable. No return-visit redirect. |
| `/catalog`       | `app/(house)/catalog/page.tsx`       | Crate permalink (same spines as `/`)                            |
| `/catalog/[slug]`| `app/(house)/catalog/[slug]/page.tsx`| Sleeve (cover, liner, tracks). Unknown slugs 404.               |
| `/collection`    | `app/(house)/collection/page.tsx`    | Full live Discogs crate (ISR 300s; durable last-good in Redis when configured) |
| `/legal`         | `app/(house)/legal/page.tsx`         | Entity + long about                                             |
| `/icon.svg`      | `app/icon.svg`                       | Site icon; `prefers-color-scheme` stroke. Applies to house and person. |
| `/favicon.ico`   | `app/favicon.ico`                    | 16/32/48 ico: `#ececec` rounded plate, mark `#20262b` (matches apple-icon). |
| `/apple-icon.png`| `app/apple-icon.png`                 | 180px, light ground, mark `#20262b`                             |
| `/opengraph-image` | `app/(house)/opengraph-image.tsx`  | House share image 1200×630. Person page keeps `/og.jpg`.        |
| `/keeganmoody33` | `app/keeganmoody33/page.tsx` | Principal / person page (Ask AI, JD Fit Analyzer, timeline)     |
| `/keegan`        | next.config + vercel.json    | 301 → `/keeganmoody33`                                          |

### Vercel Routing Rules (vercel.json)

| Type           | From             | To               | Notes               |
|----------------|------------------|------------------|---------------------|
| Redirect (301) | `/KeeganMoody33` | `/keeganmoody33` | Case normalization  |
| Redirect (301) | `/keeganMoody33` | `/keeganmoody33` | Case normalization  |
| Redirect (301) | `/keegan`        | `/keeganmoody33` | Short alias         |

**Result:** Visitors land on `lecturesfrom.com` and see the house title card + crate. `/` never redirects to the person page. The person page is at `/keeganmoody33`. House ↔ person crossings use `SignalCut` (not a global layout animation). Ask AI and JD Fit Analyzer stay on the person page only. The hero wordmark's last `o` is the static filled `LogoMark` (PNG trace, provisional, to be replaced by the design-file spec; no spin). `LogoGlobe` is kept on disk and is not mounted. `HouseFooter` is shared on `/`, `/catalog`, `/collection`, `/legal` (Motion switch not rendered). `/keeganmoody33` has its own footer.

### API Routes

| Route | Method | File | Purpose |
|-------|--------|------|---------|
| `/api/chat` | POST | `app/api/chat/route.ts` | Proxy to Supabase `chat` Edge Function |
| `/api/discogs/collection` | GET | `app/api/discogs/collection/route.ts` | Full Discogs crate (`revalidate: 300`, Redis last-good when configured). Career `/api/discogs` was removed. |
| `/api/github` | GET | `app/api/github/route.ts` | Proxy to GitHub public events API |
| `/api/jd-analyzer` | POST | `app/api/jd-analyzer/route.ts` | Proxy to Supabase `jd-analyzer` Edge Function |

---

## Provider Hierarchy

```
<html lang="en" suppressHydrationWarning>
  <head>
    logo-pause bootstrap
    Jam team metadata + recorder scripts
  </head>
  <body>
    <JamMetadata />          ← current route only
    <PostHogProvider>        ← Client-side analytics (providers.tsx)
      <Page />               ← app/(house)/page.tsx (house) or app/keeganmoody33/page.tsx
    </PostHogProvider>
  </body>
</html>
```

PostHog initializes on mount if `NEXT_PUBLIC_POSTHOG_KEY` exists. No-ops silently if missing. Jam recorder scripts load before hydration; metadata records the current route only; the site has no authentication or workspace identity source, so example IDs are not used.

---

## Component Render Order (`/keeganmoody33`)

Top to bottom, this is exactly what renders on the main page:

```
1. Marquee                          ← Full-width ticker, always visible
2. BannerRotator                    ← Drops failed/empty panels; collapses if none remain
   ├── WidgetErrorBoundary
   │   └── YouTubePlayer            ← Persistent music player (YouTube IFrame API, playlist)
   └── WidgetErrorBoundary
       └── GitHubActivity           ← Retro bar chart (14 days)
5. Main Layout Container (flex)
   ├── Navigation Header
   │   ├── Logo: /lecturesfrom (SignalCut link to `/`, direction toHouse)
   │   ├── Links: XP, Projects [P], Contact [C] (whitespace-nowrap; right group gap-x-3 gap-y-2)
   │   └── "Ask AI" button (`min-h-11`, 44px tap target)
   ├── Hero Section
   │   ├── Tagline lines (3)
   │   ├── SprayText (first name, lime)
   │   ├── SprayText (last name, orange, 500ms delay)
   │   └── CTA with "Ask AI" button
   ├── Career Timeline Section (id="experience")
   │   └── Timeline (experiences from Supabase)
   │       └── Publications (inside Timeline, for ASGM Research)
   ├── JD Analyzer Section (id="projects")
   │   └── JDAnalyzer
5b. Footer (id="contact") — sibling of `<main>`, not nested in it
   └── Social links: LinkedIn, X, Substack, GitHub, Discord, Bluesky
6. Chat Modal (conditional overlay)
   └── Chat
```

---

## Primary User Journey

```
Land on /keeganmoody33
    │
    ├─→ Scroll down → Read timeline → See career arc
    │       └─→ Click company link → Opens external site (new tab)
    │
    ├─→ Click "Ask AI" → Chat modal opens
    │       ├─→ Click suggested question OR type own
    │       ├─→ Submit → Loading dots → AI response
    │       └─→ Continue conversation or close modal
    │
    ├─→ Scroll to JD Analyzer → Paste URL or text
    │       └─→ Click "Analyze Fit" → Loading → Structured analysis
    │
    ├─→ Click play on YouTube Player → Music starts from playlist
    │       ├─→ Hover → Reveals next/prev, progress, volume
    │       └─→ Click next/prev → Changes track
    │
    └─→ Click footer social links (LinkedIn, X, Substack, GitHub, Discord, Bluesky) → Opens external profiles (new tab)
```

---

## Interaction Flows

### 1. AI Chat

**Trigger:** Click "Ask AI" button (nav or hero CTA)

**Steps:**

1. Chat modal opens (overlay)
2. If no messages: show 3 suggested questions
3. User clicks suggested question OR types own question
4. Submit (Enter key or button click)
5. Input + button disabled during loading
6. Bouncing dots animation while waiting
7. Response renders as assistant message (left-aligned, bordered card)
8. User can continue conversation or clear chat

**Success state:** AI response displayed. Conversation continues. Messages scroll to bottom automatically.

**Error state:** Error message displayed as assistant message. User can try again. Error tracked in PostHog.

**Empty state:** Suggested questions shown: "What are you looking for in your next role?", "Tell me about your experience at Mixmax", "What makes you different?"

**PostHog events:** `chat_modal_opened`, `chat_modal_closed`, `chat_message_sent`, `chat_response_received`, `chat_error`, `chat_suggested_question_clicked`, `chat_cleared`

---

### 2. JD Fit Analyzer

**Trigger:** Scroll to Projects section, interact with textarea

**Steps:**

1. User pastes job description text OR a URL into textarea
2. Click "Analyze Fit" button
3. Button shows "Analyzing...", disabled during processing
4. If URL: Edge Function scrapes via Firecrawl, then analyzes
5. If text: Edge Function analyzes directly
6. Analysis renders below textarea with "// Analysis Result" header

**Success state:** Structured analysis displayed with verdict (STRONG FIT / GOOD FIT / STRETCH FIT / EXPLORATORY), alignment items, growth areas, and "Why Connect" section.

**Error state:** Red error box with message. User can edit input and retry. Error tracked in PostHog.

**Empty state:** Textarea with placeholder text. No analysis shown until first submission.

**PostHog events:** `jd_analysis_started` (includes `input_type: 'url' | 'text'`), `jd_analysis_completed`, `jd_analysis_error`

---

### 3. Career Timeline

**Trigger:** Page load (data fetched from Supabase on mount in page.tsx)

**Steps:**

1. Page component fetches `experiences` from Supabase ordered by `display_order`
2. Passes array to `Timeline` component as props
3. Timeline renders vertical line with experience cards
4. Each card shows: date range, duration, company (linked), role title, bullets, tech pills
5. ASGM Research entry includes Publications sub-section

**Success state:** Full timeline rendered with all experiences.

**Error state:** "Loading experiences..." message if array is empty or undefined.

**Empty state:** Same as error -- "Loading experiences..." text.

**PostHog events:** `company_link_clicked` (includes `company_name`, `destination_url`)

---

### 5. Marquee Ticker

**Trigger:** Always visible on page load.

**Steps:**

1. Renders immediately with hardcoded items
2. Scrolls horizontally in infinite loop (40s cycle)
3. Hover pauses animation
4. `prefers-reduced-motion: reduce` stops the scroll (`animation: none`); items stay in place

**Success state:** Smooth infinite scroll (or a static strip under reduced motion).

**Error state:** GitHub stats stay on the loading/fallback copy; ticker still renders.

**Empty state:** N/A (hardcoded content).

**PostHog events:** None.

---

### 6. YouTube Player

**Trigger:** Page load (automatic). Loads YouTube IFrame API client-side.

**Steps:**

1. Component always renders `<Script>` tag + hidden iframe (even while loading)
2. Loading skeleton shows inline (play button + track info placeholder) via ternary
3. YouTube IFrame API script loads (`afterInteractive`)
4. `onYouTubeIframeAPIReady` fires, creates hidden YT.Player with playlist
5. Player loads playlist `PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk`
6. `onReady` sets `isLoading=false`, skeleton swaps to real controls. The hidden iframe wrapper is `inert` + `aria-hidden`; `getIframe().tabIndex = -1` so Tab never lands in the embed. Visible Play/Pause stays outside the wrapper.
7. Track title and author populate from `getVideoData()`
8. User clicks play → music starts
9. Hover expands to reveal next/prev, progress bar, volume slider
10. State persisted to `sessionStorage['yt-player-state']` on every change via `player.getPlayerState()` (not React state)

**Critical:** The `<Script>` tag and hidden iframe div must NOT be gated behind `isLoading`. The script sets `isLoading=false` via its callback — gating creates a deadlock where the skeleton renders forever.

**Success state:** Player shows track title, play/pause controls (w-6 h-6). Hover reveals full controls. Music plays from YouTube playlist.

**Error state:** Component returns `null` (graceful failure) and reports `useBannerAvailability(false)` so the rotator drops the slide and its dot. Script `onError` and a 10s timeout **started on mount** also set this path (a stalled script must not wait to `onLoad` before the clock starts). Playback errors 2/5/100/101/150 call `nextVideo()`; only a real `onError` increments the streak. After 3 in a row (or the playlist length if shorter) `setError(true)` drops the slide. The streak resets on `onReady` and PLAYING. After an error-triggered skip the stall deadline is `now + 10s` (`YT_STALL_TIMEOUT_MS`). The first BUFFERING, CUED, or new video id extends that deadline to a hard cap of `errorTime + 25s` (`YT_STALL_CAP_MS`); later BUFFERING/CUED churn does not extend past the cap. Only PLAYING (or unmount/drop) clears the stall. If the deadline passes without PLAYING, the slide drops. Slow BUFFERING (e.g. 12s then PLAYING) stays; a hung BUFFERING drops at the cap, not by restarting 10s forever. While the stall is armed the slide shows recovery chrome (dim Play with `aria-disabled` + `aria-busy`, no hover lime, `cursor-not-allowed`, title "Track unavailable, skipping…", blank author, no time). A one-video playlist still drops on the first 150. Before drop, arm the handoff only if focus is still inside the banner rotator — the Now Playing slide or `[data-banner-dots]` — never when `activeElement` is `body` (a mouse Play click then scroll) and never for nav. Always `focus({ preventScroll: true })`. BannerRotator lands on the next visible `[data-banner-panel]` control (never a rotator dot, never Play/Pause / `[data-now-playing]`) or the rotator root (`tabIndex={-1}`) if that slide has no control, or the first nav link after the slide count updates. The dots unmount when one slide remains, so a focused "Switch to Now Playing" dot must hand off. The handoff stays pending until that target exists so a leftover GitHub slide is not skipped for `body`. `NowPlayingLiveRegion` is an empty polite live region on the page at load; drop writes "Now Playing unavailable". Wrapped in `WidgetErrorBoundary`, which reports unavailable if the widget throws. If GitHub has already failed, the header stays at the skeleton height until this timeout, then collapses — no blank frame in between.

**Empty state:** Compact loading skeleton (py-2, inline layout) while IFrame API loads.

**sessionStorage contract (Phase 2 Turntable handoff):**

- Key: `yt-player-state`
- Stores: `videoId`, `trackTitle`, `trackAuthor`, `position`, `duration`, `playing`, `playlistIndex`, `volume`, `timestamp`

**PostHog events:** `youtube_player_loaded`, `youtube_player_play`, `youtube_player_pause`, `youtube_track_changed`

---

### 6b. BannerRotator + GitHub Activity

**Trigger:** Page load. `BannerRotator` mounts YouTube and GitHub together; only the active panel is visible.

**Steps:**

1. Each widget reports `useBannerAvailability(true|false)`
2. Failed, empty, or error-boundary panels are removed from rotation and from the dots
3. Two or more available panels: 8s auto-rotate (skipped under `prefers-reduced-motion: reduce`); dots stay for manual switching. Inactive panels get `aria-hidden` + `inert` so tab focus cannot land on invisible controls. Content uses `pr-16` so `/ 7d` clears the 24×24 dot hit areas; the bar itself is full-bleed.
4. One available panel: show it statically, no dots, no extra `pr-16`
5. Zero available panels: rotator returns `null` — the banner row collapses; Marquee remains

**GitHub Activity error:** `/api/github` 5xx (including GitHub's unauthenticated 60/hr 502) → component returns `null` and reports unavailable. No blank 8s slot.

**GitHub route:** No GitHub token env var. Upstream fetch uses `next: { revalidate: 300 }`.

---

### 7. SprayText Hero Animation

**Trigger:** Page load with configurable delay.

**Steps:**

1. Component mounts with `opacity-0`
2. After delay (0ms for first name, 500ms for last name), `visible` state set to true
3. Characters animate in sequence (50ms per character)
4. Each character: blur(8px) → scale(0.95) → normal (150ms spray effect)

**Success state:** Name appears with spray paint animation.

**Error state:** N/A (pure CSS animation).

**Empty state:** Invisible text maintaining layout space.

**PostHog events:** None.

---

## Mobile vs Desktop Differences

| Element | Desktop | Mobile |
|---------|---------|--------|
| Chat modal | Overlay on page | Same (full overlay) |
| Navigation | Horizontal top bar | Same; items `whitespace-nowrap`, right group `gap-x-3 gap-y-2` |
| BannerRotator | Full-bleed bar; `pr-16` on content only when dots show | Same |
| Timeline | Full-width cards | Same layout (no responsive changes) |
| JD Analyzer | Full-width textarea | Same layout |

---

## Data Flow Summary

```
Supabase DB
    │
    ├── candidate_profile ──→ page.tsx (fetched on mount)
    ├── experiences ─────────→ page.tsx → Timeline component (props)
    │
    ├── [via Edge Functions]
    │   ├── chat/index.ts ──→ /api/chat ──→ Chat component
    │   └── jd-analyzer/index.ts ──→ /api/jd-analyzer ──→ JDAnalyzer component
    │
Discogs API
    └── fetchFullCollection() ──→ house `/collection`, `/api/discogs/collection`, `/collection.md`
            └── Upstash Redis last-good (`lf:discogs:collection:v1`) when env is set
            └── not used on `/keeganmoody33` (career `/api/discogs` / RecentDigs removed)

YouTube IFrame API (client-side, no proxy)
    └── youtube.com/iframe_api ──→ YouTubePlayer component
        └── sessionStorage (yt-player-state) ──→ Phase 2 Turntable handoff

GitHub Public Events API
    └── /api/github ──→ Marquee + GitHubActivity components

All interactions ──→ PostHog (client + server events)
```

---

### 12. SIGNAL CUT (house <-> person)

**Trigger:** Same-tab unmodified primary click (or Enter) on a `SignalCut`-wrapped `next/link` that crosses house `/` and person `/keeganmoody33` (or `/keegan`).

**Wrapped links (this branch):**
- Person-page nav wordmark `lecturesfrom` → `/` (`direction="toHouse"`)
- Crate row 04 `keegan moody` → `/keeganmoody33` (`direction="toPerson"`)

**Does not play on:** first load, hash changes, back/forward, house <-> house routes, modifier/middle clicks, `target="_blank"`.

**Steps:**

1. Click intercepts client navigation (`onClick` + Next.js `onNavigate`) but the `<a href>` remains for no-JS / crawlers
2. Module-level controller appends a `position:fixed` overlay to `document.body` (survives the Link unmount; not mounted in `app/layout.tsx`)
3. First crossing in the tab (`sessionStorage lf-signal-cut-count` 0): 420ms tear → analog snow → black + id line (`km-33 → lf-01` or reverse) → fade. Overlay is fully opaque from snow start (60ms). `router.push` at snow-end / black (280ms) so person-page hydration does not starve the snow deadline
4. Later crossings: 160ms tear + black + id, push at black (40ms)
5. `prefers-reduced-motion: reduce`: 80ms black, push immediately, no tear/snow/id/fade
6. Phase deadlines are `setTimeout` from click `t0` (snow paint is rAF-only). If the destination pathname has not committed by reveal start, hold black (id omitted when reduced) until it does, hard cap 1500ms from click. No extra quiet-frame wait.

**Success state:** Destination paints under the overlay; overlay removed at end of reveal. CLS 0.

**Error / abort state:** One idempotent `teardown()` (Copilot review comment 4111027402). It stops snow, cancels every timeout and rAF, reverts `document.documentElement` transform/classes, and removes the overlay. Called from completion, hard-cap fallback (`setTimeout(1500 + fade + 80)`), slow-destination hold, popstate, pagehide, `visibilitychange` hidden, thrown errors, and a second click (swallowed so no second loop). The triggering Link's React unmount is **not** a teardown path — that unmount is the route swap. Hidden-tab abort does not navigate if `router.push` has not already run.

**PostHog events:** `signal_cut_started` (`direction`, `href`)

---

## Related Docs

- [PRD.md](PRD.md) -- Product definition, features, scope
- [TECH_STACK.md](TECH_STACK.md) -- Locked dependencies and external services
- [FRONTEND_GUIDELINES.md](FRONTEND_GUIDELINES.md) -- Design system, tokens, component patterns
- [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) -- Database schema, API contracts, Edge Functions
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) -- Phased build sequence
- [progress.txt](progress.txt) -- Current completion state
- [lessons.md](lessons.md) -- Mistakes and patterns to avoid

---

*App Flow v1.0 -- Every page, every route, every state documented. AI doesn't guess how users move through the app.*
