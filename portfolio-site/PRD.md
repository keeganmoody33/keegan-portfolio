# PRD — lecturesfrom.com Portfolio

**Last Updated:** 2026-09-28
**Status:** House cut in preview. Person page remains at /keeganmoody33.
**Live URL:** [lecturesfrom.com](https://www.lecturesfrom.com) (house) · [lecturesfrom.com/keeganmoody33](https://www.lecturesfrom.com/keeganmoody33) (principal)

---

## Product Definition

An AI-queryable portfolio for Keegan Moody, now entered through the lecturesfrom house. `/` is the company title card and crate. The principal channel remains `/keeganmoody33` with chat, JD fit analysis, and career timeline.

The site is the product. The product demonstrates the builder.

---

## Target Users

| User | Goal | Core Action |
|------|------|-------------|
| **Recruiters** | Evaluate candidate fit quickly | Paste a JD into the analyzer, get a structured fit assessment |
| **Hiring Managers** | Understand depth beyond resume | Chat with the AI, ask about specific experiences |
| **Potential Collaborators** | See what Keegan builds and how he thinks | Browse timeline, explore projects, read publications |
| **Keegan (operator)** | Represent himself authentically at scale | Maintain data, tune AI behavior, ship new features |

---

## In Scope

Everything that serves the core purpose: help visitors understand who Keegan is, what he's built, and whether there's a fit.

### Shipped Features

| Feature | Component(s) | Status |
|---------|-------------|--------|
| Career Timeline | `Timeline.tsx`, Supabase `experiences` table | **Shipped** |
| AI Chat | `Chat.tsx`, `/api/chat`, `chat` Edge Function | **Shipped** |
| JD Fit Analyzer | `JDAnalyzer.tsx`, `/api/jd-analyzer`, `jd-analyzer` Edge Function | **Shipped** |
| Spray Paint Hero | `SprayText.tsx` | **Shipped** |
| Marquee Ticker | `Marquee.tsx` | **Shipped** |
| Recent Digs (Discogs) | `RecentDigs.tsx`, `/api/discogs` | **Removed from `/keeganmoody33`** — crate lives at house `/collection` |
| Activity Stream Sidebar | `ActivityStream.tsx` | **Shipped** |
| Publications Section | `Publications.tsx` (inside Timeline) | **Shipped** |
| PostHog Analytics | Client + server-side tracking | **Shipped** |
| Vercel Deployment | Auto-deploy on push to main | **Shipped** |
| Dark/Light Theme Toggle | ActivityStream theme buttons, CSS custom properties | **Shipped** |
| YouTube Persistent Player | `YouTubePlayer.tsx`, `types/youtube.d.ts` | **Shipped** |
| GitHub Activity Widget | `GitHubActivity.tsx`, `/api/github` | **Shipped** |
| Turntable Loading Page | `TurntableCanvas.tsx` (left on disk, not mounted at `/`) | **Retired from `/`** — 2026-09-26 house cut |
| House title card + crate | `app/(house)/page.tsx`, `lib/catalog.ts`, `components/house/*` | **Shipped** |
| lecturesfrom logo mark + favicon + house share image | `LogoMark.tsx`, `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`, `app/(house)/opengraph-image.png` | **Shipped** |
| Hero wordmark o = static lecturesfrom mark | `HouseWordmark.tsx` — last `o` in `from` is the static filled `LogoMark` (owner PNG trace for geometry / strokes / layer order; on-fill outlines `var(--house-bg)`, empty / ring `currentColor`; fills `--lf-mark-*`, flag `var(--house-orange)`) at Chakra Petch x-height; favicon / og stay the older line-mark and now mismatch (follow-up); no standalone coin above the wordmark. | **Shipped on the house title card** |
| Sleeves | `/catalog`, `/catalog/[slug]` | **Shipped (this PR)** |
| Full Discogs crate | `/collection`, `/api/discogs/collection` | **Shipped** — durable Redis last-good when Upstash env is set |
| SignalCut | `components/SignalCut.tsx` | **Shipped (this PR)** — house ↔ person only |
| lecturesfrom nameplate wordmark (assets) | `brand/lecturesfrom-wordmark.svg`, `scripts/generate-wordmark.py` | **Assets only.** Not wired into header or pages. Hathaway vectors in `public/brand/` are a separate unused direction. |

### Spec-Locked (Not Yet Built)

| Feature | Spec Doc | Status |
|---------|----------|--------|
| Banner Widget Section | `docs/BANNER_WIDGETS_SPEC.md` | **Spec Locked** |
| Human/Machine Toggle | `docs/HUMAN_MACHINE_TOGGLE_SPEC.md` | **Spec Locked** |
| Navigation Pathways + Vinyl Grid | `docs/NAVIGATION_PATHWAYS_SPEC.md` | **Spec Locked** |

### Parking Lot (Ideas, Not Scoped)

- Stack of Wax (vinyl grid overlay for Discogs collection)
- Physical Products placeholder page
- Easter eggs (Konami code, hidden /practice route)
- Console.log personality messages

---

## Out of Scope

These are explicitly **not** what this site is:

- **Not a CMS** -- content lives in Supabase and markdown files, not a CMS admin panel
- **Not a blog** -- Keegan has Substack for that
- **Not a content brand** -- the work matters more than the visibility (per `source-interviews/06_LECTURES_FROM.md`)
- **Not a job board** -- visitors evaluate Keegan, not the other way around
- **Not a services menu** -- house copy is issued, not "we help teams scale"
- **Not Ask AI / JD analyzer on the house** -- those stay on `/keeganmoody33`

---

## User Stories

### Recruiter / Hiring Manager

1. **As a recruiter**, I want to paste a job description and get an honest fit assessment so I know whether to reach out.
2. **As a hiring manager**, I want to ask the AI specific questions about Keegan's experience so I can evaluate depth beyond bullet points.
3. **As a recruiter**, I want to browse the career timeline chronologically so I can quickly understand the career arc.
4. **As a hiring manager**, I want to see publications and research credentials so I can assess the science background claim.

### Visitor / Collaborator

1. **As a visitor**, I want to browse the house crate at `/collection` so I can see the lecturesfrom record collection.
2. **As a collaborator**, I want to find LinkedIn/GitHub/Substack links so I can connect on other platforms.
3. **As a visitor**, I want the site to load fast and look good on my phone so I can browse during a commute.

### Keegan (Operator)

1. **As the operator**, I want AI behavior tuned via `ai_instructions` table so I can adjust tone without redeploying code.
2. **As the operator**, I want PostHog tracking on every interaction so I can see what visitors actually do.
3. **As the operator**, I want the AI to lead with value and only acknowledge gaps when directly asked.

---

## Success Criteria

| Criteria | Metric | Target |
|----------|--------|--------|
| Site loads | Time to interactive | < 3 seconds |
| Chat works | Response returned for any question | 100% uptime when Supabase/Claude are up |
| JD Analyzer works | Analysis returned for text or URL input | Structured output with verdict every time |
| Mobile usable | Core actions work on phone | Chat, Timeline, JD Analyzer all functional |
| AI leads with value | No self-sabotaging language unprompted | Zero instances of volunteering firing history |
| Analytics flowing | PostHog captures events | All shipped features tracked |
| Discogs live | House `/collection` shows the live crate | Full lecturesfrom collection (not on `/keeganmoody33`) |

---

## Non-Goals

- Perfect accessibility compliance (improve over time, not a launch blocker)
- SEO optimization (traffic comes from direct links, not search)
- Multi-language support
- User accounts or visitor login
- Real-time chat (request/response is fine)
- Streaming AI responses (nice-to-have later, not required)

---

## Open Questions

1. **Navigation redesign** -- Current top nav vs. fixed left sidebar (per `FRONTEND_GUIDELINES.md` and `docs/NAVIGATION_PATHWAYS_SPEC.md`). When to ship?

---

## Related Docs

- [APP_FLOW.md](APP_FLOW.md) -- Route inventory and interaction flows
- [TECH_STACK.md](TECH_STACK.md) -- Locked dependencies and external services
- [FRONTEND_GUIDELINES.md](FRONTEND_GUIDELINES.md) -- Design system, tokens, component patterns
- [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) -- Database schema, API contracts, Edge Functions
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) -- Phased build sequence
- [progress.txt](progress.txt) -- Current completion state
- [lessons.md](lessons.md) -- Mistakes and patterns to avoid

---

*PRD v1.0 -- Documentation-first. Code second. Always.*
