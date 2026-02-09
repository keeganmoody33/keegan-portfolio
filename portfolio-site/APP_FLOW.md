# App Flow — lecturesfrom.com Portfolio

**Last Updated:** 2026-02-09
**Framework:** Next.js (App Router)
**Deployment:** Vercel (auto-deploy on push to main)

---

## Route Inventory

### Pages

| Route | File | What It Shows |
|-------|------|---------------|
| `/` | `app/page.tsx` | Main portfolio page (all content on one page) |
| `/keeganmoody33` | Vercel rewrite → `/` | Public-facing URL; rewrites internally to `/` |

### Vercel Routing Rules (vercel.json)

| Type | From | To | Notes |
|------|------|----|-------|
| Redirect (301) | `/` | `/keeganmoody33` | Root always redirects to vanity URL |
| Redirect (301) | `/KeeganMoody33` | `/keeganmoody33` | Case normalization |
| Redirect (301) | `/keeganMoody33` | `/keeganmoody33` | Case normalization |
| Rewrite | `/keeganmoody33` | `/` | Internal rewrite; URL stays `/keeganmoody33` |

**Result:** Visitors always see `lecturesfrom.com/keeganmoody33` in their browser. Internally, Next.js serves `app/page.tsx`.

### API Routes

| Route | Method | File | Purpose |
|-------|--------|------|---------|
| `/api/chat` | POST | `app/api/chat/route.ts` | Proxy to Supabase `chat` Edge Function |
| `/api/discogs` | GET | `app/api/discogs/route.ts` | Proxy to Discogs API |
| `/api/jd-analyzer` | POST | `app/api/jd-analyzer/route.ts` | Proxy to Supabase `jd-analyzer` Edge Function |

---

## Provider Hierarchy

```
<html lang="en">
  <body>
    <PostHogProvider>        ← Client-side analytics (providers.tsx)
      <Page />               ← app/page.tsx
    </PostHogProvider>
  </body>
</html>
```

PostHog initializes on mount if `NEXT_PUBLIC_POSTHOG_KEY` exists. No-ops silently if missing.

---

## Component Render Order (page.tsx)

Top to bottom, this is exactly what renders on the main page:

```
1. Marquee                          ← Full-width ticker, always visible
2. WidgetErrorBoundary
   └── RecentDigs                   ← Discogs widget (5 records)
3. Main Layout Container (flex)
   ├── Navigation Header
   │   ├── Logo: /lecturesfrom
   │   ├── Links: XP, Projects [P], Contact [C]
   │   └── "Ask AI" button
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
   ├── Footer (id="contact")
   │   └── Social links: LinkedIn, X, Substack, GitHub
   ├── Sidebar Toggle Button (fixed, bottom-right)
   └── Activity Stream Sidebar (conditional, fixed right)
       └── ActivityStream
4. Chat Modal (conditional overlay)
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
    ├─→ Click record in Recent Digs → Opens Discogs page (new tab)
    │
    ├─→ Click "Show Activity" → Sidebar slides in
    │       └─→ Theme toggle buttons (dark/light)
    │
    └─→ Click footer social links → Opens external profiles (new tab)
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

### 3. Recent Digs (Discogs Widget)

**Trigger:** Page load (automatic)

**Steps:**
1. Component mounts, fires GET `/api/discogs`
2. Loading skeleton renders (5 pulsing items)
3. Data returns: 5 records with cover art, title, artist
4. Each record links to Discogs release page

**Success state:** 5 records displayed. Desktop: horizontal row. Mobile: horizontal scroll with snap points.

**Error state:** Component returns `null` (graceful failure -- widget disappears, page unaffected). Wrapped in `WidgetErrorBoundary`.

**Empty state:** Component returns `null` if no releases returned.

**PostHog events:** `recent_digs_record_clicked` (includes `title`, `artist`, `discogsUrl`)

---

### 4. Career Timeline

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

### 5. Activity Stream Sidebar

**Trigger:** Click "Show Activity" button (fixed, bottom-right)

**Steps:**
1. Sidebar slides in from right (fixed position)
2. Shows system log entries (currently hardcoded/simulated)
3. Theme toggle buttons at bottom (dark/light)
4. Click toggle button to switch theme

**Success state:** Sidebar visible with log entries and theme controls.

**Error state:** N/A (hardcoded data, always renders).

**Empty state:** N/A (always has initial log entries).

**PostHog events:** `activity_sidebar_toggled`, `theme_changed` (includes `theme: 'dark' | 'light'`)

---

### 6. Marquee Ticker

**Trigger:** Always visible on page load.

**Steps:**
1. Renders immediately with hardcoded items
2. Scrolls horizontally in infinite loop (40s cycle)
3. Hover pauses animation

**Success state:** Smooth infinite scroll.

**Error state:** N/A (no data fetching, no interaction).

**Empty state:** N/A (hardcoded content).

**PostHog events:** None.

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
| Recent Digs | Horizontal row (`flex`) | Horizontal scroll with snap points (`snap-x`) |
| Recent Digs items | `flex-1` fill available space | Fixed `w-[140px]` with `touch-pan-x` |
| Chat modal | Overlay on page | Same (full overlay) |
| Activity sidebar | Fixed right panel | Same (fixed right, may overlap content) |
| Navigation | Horizontal top bar | Same (no hamburger menu currently) |
| Timeline | Full-width cards | Same layout (no responsive changes) |
| JD Analyzer | Full-width textarea | Same layout |

**Note:** Most components lack dedicated mobile responsive handling beyond Recent Digs. This is a known area for improvement.

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
    └── /api/discogs ──→ RecentDigs component

All interactions ──→ PostHog (client + server events)
```

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
