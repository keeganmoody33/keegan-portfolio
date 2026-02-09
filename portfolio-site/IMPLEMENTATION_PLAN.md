# Implementation Plan — lecturesfrom.com Portfolio

**Last Updated:** 2026-02-09
**Status:** Phase 0 complete (MVP shipped). Phases 1-5 sequenced below.
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
- Recent Digs (Discogs) banner widget
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

### Step 1.1 — YouTube Persistent Player Widget

- **Goal:** Embed YouTube player in banner that can play from Keegan's playlist
- **Output:** `components/YouTubePlayer.tsx`, potentially `app/api/youtube/route.ts` if playlist data needed
- **Technical:** YouTube IFrame API, playlist `PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk`
- **Controls:** Play/pause, next/prev, track info
- **State:** `sessionStorage` for audio state (will connect to Turntable in Phase 2)
- **PostHog:** `youtube_player_play`, `youtube_player_pause`, `youtube_track_changed`
- **Validation:** Player loads, plays audio, switches tracks, persists across page sections

### Step 1.2 — GitHub Activity Widget

- **Goal:** Show recent commit activity as retro vertical bars
- **Output:** `components/GitHubActivity.tsx`, `app/api/github/route.ts` (proxy)
- **Technical:** GitHub REST API `api.github.com/users/keeganmoody33/events` (public, no auth needed)
- **Visual:** Classic arcade/pixel aesthetic per `BANNER_WIDGETS_SPEC.md`
- **Data:** Last 7-14 days of contributions aggregated into bars
- **PostHog:** `github_activity_clicked`
- **Validation:** Bars render with real data, clicking opens GitHub profile

### Step 1.3 — Worthy Reads Widget

- **Goal:** Curated reading list (3-5 items)
- **Output:** `components/WorthyReads.tsx`
- **Technical:** Data source TBD -- likely JSON config file or Supabase table
- **Display:** Title, source, link for each item
- **PostHog:** `worthy_reads_link_clicked`
- **Validation:** Links render, open in new tab
- **Blocker:** Need to decide data source before building (see PRD.md open questions)

### Step 1.4 — Banner Section Layout

- **Goal:** Arrange all 4 widgets (YouTube, GitHub, Discogs, Worthy Reads) in banner
- **Output:** Update `app/page.tsx` to compose widgets in banner section
- **Technical:** Layout TBD in Aura per spec, but must be responsive
- **Validation:** All 4 widgets visible on desktop and mobile, hover stops marquee scroll

---

## Phase 2: Turntable Loading Experience

**Goal:** Entry experience with needle drop = play button = enter site.

**Inputs:** `docs/TURNTABLE_LOADING_SPEC.md`, `FRONTEND_GUIDELINES.md`

**Depends on:** Phase 1 Step 1.1 (YouTube player must exist for state handoff)

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

- **Goal:** Return visitors skip turntable, go straight to portfolio
- **Technical:** `localStorage` flag set after first visit
- **Validation:** First visit shows turntable. Subsequent visits skip to portfolio.

### Step 2.4 — Integration

- **Goal:** Wire turntable as entry point
- **Output:** Update routing to show turntable first, portfolio second
- **Validation:** Full flow works: turntable → needle drop → music plays → portfolio loads → music continues in banner

---

## Phase 3: Alan Iverson Chat Persona (DEFERRED)

**Status:** Backlogged. Deprioritized as of 2026-02-09 -- too large to tackle before Phases 1-2 are complete. See LEC-23 (moved to Backlog in Linear).

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
- **Output:** `components/StackOfWax.tsx`, potentially updated `/api/discogs` route
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
    ├── Phase 1: Banner Widgets
    │       │
    │       └── Phase 2: Turntable (needs YouTube player from 1.1)
    │
    ├── Phase 3: Alan Iverson (independent, needs Chat from Phase 0)
    │
    ├── Phase 4: Navigation + Vinyl Grid (independent)
    │       │
    │       └── Phase 5: Human/Machine Toggle (needs nav from Phase 4)
    │
```

Phases 1, 3, and 4 can run in parallel after Phase 0.

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
