# Implementation Plan — lecturesfrom.com Portfolio

**Last Updated:** 2026-09-27
**Status:** House cut implemented (title card, sleeves, full crate, signal cut, agent files, logo mark). Person page frozen except wordmark.
**Previous plan:** `IMPLEMENTATION_PLAN_DISCOGS_ARCHIVED.md` (completed Discogs widget build)

---

## Phase 0: Foundation (COMPLETED)

**Goal:** Ship the MVP portfolio with AI chat, JD analyzer, career timeline, and analytics.

**What shipped:**

- Single-page portfolio (`app/page.tsx`)
- Hero with SprayText animation
- Career Timeline from Supabase `experiences` table
- AI Chat via Supabase Edge Functions + Claude API
- JD Fit Analyzer with Firecrawl URL scraping
- Marquee ticker
- Recent Digs (Discogs) banner widget — **removed from `/keeganmoody33`**; crate lives at house `/collection`
- Activity Stream sidebar with theme toggle
- Publications section (inside Timeline)
- PostHog analytics (client + server)
- Vercel deployment with URL rewrites
- Canonical documentation (PRD, APP_FLOW, TECH_STACK, FRONTEND_GUIDELINES, BACKEND_STRUCTURE)

**Validation:** Live at [lecturesfrom.com/keeganmoody33](https://lecturesfrom.com/keeganmoody33). All features functional.

---

## Phase 1: Banner Widget Section Buildout

**Goal:** Complete the banner section with all 4 widgets specified in `docs/BANNER_WIDGETS_SPEC.md`.

**Inputs:** `BANNER_WIDGETS_SPEC.md`, `FRONTEND_GUIDELINES.md`

### Step 1.1 — YouTube Persistent Player Widget (DONE)

- **Status:** Completed 2026-02-08
- **Output:** `components/YouTubePlayer.tsx`, `types/youtube.d.ts`
- **Technical:** YouTube IFrame API loaded client-side via `next/script`. No API route needed.
- **Playlist:** `PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk`
- **Controls:** Play/pause, next/prev (hover-reveal), track info, progress bar, volume
- **State:** `sessionStorage['yt-player-state']` -- stores videoId, trackTitle, trackAuthor, position, duration, playing, playlistIndex, volume, timestamp
- **PostHog:** `youtube_player_loaded`, `youtube_player_play`, `youtube_player_pause`, `youtube_track_changed`
- **Phase 2 handoff:** On mount, reads sessionStorage. If `playing: true` and timestamp < 30s old, resumes playback. This is how the Turntable hands off to the banner player.

### Step 1.2 — GitHub Activity Widget (DONE)

- **Status:** Completed 2026-02-08
- **Output:** `components/GitHubActivity.tsx`, `app/api/github/route.ts`
- **Technical:** GitHub REST API (public, no auth), 5-min revalidation cache
- **Visual:** Retro vertical bars, 14-day breakdown, lime accent with glow on today's bar
- **PostHog:** `github_activity_clicked`

### Step 1.3 — Worthy Reads Widget (CANCELLED)

- **Status:** CANCELLED 2026-07-24 — feature descoped

### Step 1.4 — Banner Section Layout (DONE)

- **Status:** Completed — `BannerRotator` on `/keeganmoody33` now cycles YouTube + GitHub. Recent Digs removed; crate lives at house `/collection`.
- **Output:** `components/BannerRotator.tsx` composes widgets in a single rotating slot below Marquee — 8s auto-rotate, pause-on-hover, dot indicators
- **Validation:** Remaining widgets visible on desktop and mobile, hover pauses rotation

---

## Phase 2: Turntable Loading Experience (SUPERSEDED)

**Goal:** Entry experience with needle drop = play button = enter site.

**Status:** SUPERSEDED 2026-09-26 by the house cut: turntable root and hasVisitedPortfolio redirect removed; `/` is the lecturesfrom house.

**Inputs:** `docs/TURNTABLE_LOADING_SPEC.md`, `FRONTEND_GUIDELINES.md`

**Depends on:** Phase 1 Step 1.1 (DONE -- `components/YouTubePlayer.tsx` exists with sessionStorage handoff)

**Autoplay strategy:** Browsers block audio autoplay unless preceded by a user gesture. The turntable needle drop IS the user gesture -- the user clicks/taps to drop the needle, which calls `player.playVideo()`. Because this happens inside a click event handler, the browser allows audio. No autoplay workaround needed. The flow is: user click -> playVideo() -> music starts -> transition to portfolio -> banner YouTubePlayer reads sessionStorage and continues playback.

**Deployment strategy:** Build on `feature/turntable-loading` branch. Push to get Vercel preview URL. Test on desktop + mobile. Merge to main only when verified. Rollback: `git revert HEAD`.

### Step 2.1 — Turntable Visual

- **Goal:** 45-degree angle turntable with sketch aesthetic
- **Output:** `components/Turntable.tsx` or `app/turntable/page.tsx` (routing TBD)
- **Visual:** Designed in Aura.build per spec
- **Interaction:** Needle drop triggers play + site entry
- **Skip button:** Subtle, doesn't say "skip" -- messaging per spec

### Step 2.2 — Audio State Handoff

- **Goal:** Music starts on turntable, continues in banner player
- **Technical:** `sessionStorage` for playback state (track, position, playing)
- **Output:** Shared state logic between Turntable and YouTubePlayer components

### Step 2.3 — Return Visitor Bypass

- **Status:** SUPERSEDED 2026-09-26 by the house cut: turntable root and hasVisitedPortfolio redirect removed; `/` is the lecturesfrom house.
- **Goal:** Return visitors skip turntable, go straight to portfolio
- **Technical:** `localStorage` flag set after first visit — do not restore. Returning visitors land on the house root.
- **Validation:** First visit shows turntable. Subsequent visits skip to portfolio. — void. `/` never redirects to `/keeganmoody33`.

### Step 2.4 — Integration

- **Goal:** Wire turntable as entry point
- **Output:** Update routing to show turntable first, portfolio second
- **Validation:** Full flow works: turntable → needle drop → music plays → portfolio loads → music continues in banner

---

## Phase 3: Alan Iverson Chat Persona (CANCELLED)

**Status:** CANCELLED 2026-07-24 — feature descoped.

**Goal:** Add Alan Iverson character to chat experience.

**Inputs:** `docs/ALAN_IVERSON_SPEC.md`, `FRONTEND_GUIDELINES.md`

**Depends on:** Phase 0 complete (Chat must work). Independent of Phases 1-2.

### Step 3.1 — Character Assets

- **Goal:** Create Alan character (enter, idle, exit animations)
- **Output:** Asset files (Lottie or WebM per spec)
- **Art style:** Prototype both Street 3D and 60s Comic in Aura, pick winner
- **Blocker:** Style decision needed before implementation

### Step 3.2 — Chat Overlay Refactor

- **Goal:** Refactor Chat component to support character overlay
- **Output:** Updated `components/Chat.tsx`
- **Sequence:** Alan swoops in → "practice" bubble → handoff line → Alan fades to idle → Keegan voice takes over

### Step 3.3 — Session Logic

- **Goal:** Intro bubble shows only first chat open per session
- **Technical:** `sessionStorage` flag
- **Subsequent opens:** Alan appears (enters) but skips "practice" bubble

### Step 3.4 — Integration & Polish

- **Output:** Updated `app/page.tsx` chat modal section
- **Validation:** Open chat → Alan appears → intro plays (first time) → ask question → Keegan responds → Alan stays idle at 75-85% opacity

---

## Phase 4: Navigation Pathways + Vinyl Grid

**Goal:** Multi-page navigation with vinyl grid overlay for projects and records.

**Inputs:** `docs/NAVIGATION_PATHWAYS_SPEC.md`, `FRONTEND_GUIDELINES.md`

**Depends on:** Phase 0 complete. Can run parallel to Phases 2-3.

### Step 4.1 — Navigation Structure

- **Goal:** Implement 7 top-level nav items per spec
- **Output:** Updated nav component, new page routes
- **Pages:** Personal Projects, Physical Products (placeholder), My Stack of Wax, Who I Am, About LecturesFrom, Contact, Work With Me

### Step 4.2 — Vinyl Grid Overlay

- **Goal:** Full-screen overlay with album-tile-sized grid for projects and records
- **Output:** `components/VinylGrid.tsx`, `components/VinylTile.tsx`
- **Visual:** Designed in Aura per spec
- **Interaction:** Hover tilt (10-15 degrees), click to expand or route

### Step 4.3 — Project Detail Pages

- **Goal:** Individual project pages for built-out projects
- **Output:** `app/projects/[id]/page.tsx`
- **Data:** Local JSON initially, Supabase migration later per spec

### Step 4.4 — Stack of Wax (Discogs Collection)

- **Goal:** Full vinyl collection browsing via Discogs API
- **Output:** `components/StackOfWax.tsx` on house `/collection` via `/api/discogs/collection`. Career-only `/api/discogs` (recent-5) has been removed — do not revive it.
- **Validation:** Grid shows collection, clicking tile opens Discogs page

---

## Phase 5: Human/Machine Toggle

**Goal:** Dual-mode site -- Human (visual) and Machine (structured data/API docs).

**Inputs:** `docs/HUMAN_MACHINE_TOGGLE_SPEC.md`, `FRONTEND_GUIDELINES.md`

**Depends on:** Phase 4 (navigation must exist for Machine mode to have content to transform).

### Step 5.1 — Toggle Component

- **Goal:** Sticky bottom-center toggle between Human and Machine views
- **Output:** `components/ModeToggle.tsx`
- **State:** React Context for global mode state
- **URL:** Support `?view=machine` landing

### Step 5.2 — Dual Content (Hero + About)

- **Goal:** Hero and About sections have Human and Machine variants
- **Output:** Updated page sections with conditional rendering
- **Machine content:** Schemas, API docs, markdown tables, monospace terminal aesthetic

### Step 5.3 — Machine Proof Sections

- **Goal:** JD Analyzer and Chat API as interactive Machine-mode proof blocks
- **Output:** Updated `JDAnalyzer.tsx` and `Chat.tsx` with Machine mode views
- **Machine view:** JSON Schema I/O, request/response examples, streaming flag docs

### Step 5.4 — Turntable Config Loading

- **Goal:** Machine mode turntable shows runtime config panel instead of visual turntable
- **Output:** Config panel component showing schema version, sample request
- **Validation:** Toggle instantly swaps all content, scroll position preserved

---

## Dependency Graph

```
Phase 0 (DONE)
    │
    ├── Phase 1: Banner Widgets (Steps 1.1-1.4 DONE, Step 1.3 CANCELLED)
    │       │
    │       └── Phase 2: Turntable (SUPERSEDED 2026-09-26 by the house cut: turntable root and hasVisitedPortfolio redirect removed; / is the lecturesfrom house.)
    │
    ├── Phase 3: Alan Iverson (CANCELLED)
    │
    ├── Phase 4: Navigation + Vinyl Grid (independent)
    │       │
    │       └── Phase 5: Human/Machine Toggle (needs nav from Phase 4)
    │
```

Phases 1 and 4 can run in parallel after Phase 0. Phase 3 is cancelled.

### House brand mark (DONE — this PR)

- **Output:** `components/house/LogoMark.tsx` on the root title card; `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`; house `opengraph-image` / `twitter-image` from `brand/house-share.png`.
- **Globe:** `LogoGlobe` layers stay. Shared `.lf-logo-globe-spin` wrapper coins-spins the whole mark (`rotateY` 12s). Core stays `animation: none` (face-on). Owner override of house "No 3D", scoped to this mark. HouseFooter Motion switch for WCAG 2.2.2; composed with SignalCut via pause-only CSS attributes on `<html>`. Root layout blocking script applies a saved pause before first paint (`suppressHydrationWarning` on `<html>`).
- **Wordmark o:** `HouseWordmark` replaces the last `o` in `from` with static `LogoMark` `layer="wordmark"` (`groupIds={false}`, `focusable={false}`). Ring + orbit ellipse, one shared stroke, no inner detail. Stroke is `0.6` of the SemiBold stem (`0.069em`); 0.7 and 0.65 were measured and failed “o coverage strictly between r and m”. Scale inward so the ring’s outer diameter stays in the x-height box. Orbit geometry is not shrunk. In-flow transparent `o` keeps glyph advance. Full word is `.sr-only`. Does not read `data-logo-paused`, spin, or draw a rim. Favicon / og / footer switch / title-card globe stroke and core unchanged.
- **Validation:** lint / typecheck / build; `/keeganmoody33` `og:image` stays `/og.jpg`.

---

## Related Docs

- [PRD.md](PRD.md) -- Product definition, features, scope
- [APP_FLOW.md](APP_FLOW.md) -- Route inventory and interaction flows
- [TECH_STACK.md](TECH_STACK.md) -- Locked dependencies and external services
- [FRONTEND_GUIDELINES.md](FRONTEND_GUIDELINES.md) -- Design system, tokens, component patterns
- [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) -- Database schema, API contracts, Edge Functions
- [progress.txt](progress.txt) -- Current completion state
- [lessons.md](lessons.md) -- Mistakes and patterns to avoid

---

*Implementation Plan v1.0 -- Step by step with a plan. The more steps, the less AI guesses.*
