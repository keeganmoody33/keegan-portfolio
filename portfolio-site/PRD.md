# PRD — lecturesfrom.com Portfolio

**Last Updated:** 2026-02-09
**Status:** MVP Shipped, Iterating
**Live URL:** [lecturesfrom.com/keeganmoody33](https://lecturesfrom.com/keeganmoody33)

---

## Product Definition

An AI-queryable portfolio site for Keegan Moody at **lecturesfrom.com**. Not a static resume. Not a content brand. An interactive system where recruiters, hiring managers, and potential collaborators can query Keegan's background directly -- via AI chat, JD fit analysis, or career timeline browsing.

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
| Recent Digs (Discogs) | `RecentDigs.tsx`, `/api/discogs` | **Shipped** |
| Activity Stream Sidebar | `ActivityStream.tsx` | **Shipped** |
| Publications Section | `Publications.tsx` (inside Timeline) | **Shipped** |
| PostHog Analytics | Client + server-side tracking | **Shipped** |
| Vercel Deployment | Auto-deploy on push to main | **Shipped** |
| Dark/Light Theme Toggle | ActivityStream theme buttons, CSS custom properties | **Shipped** |

### Spec-Locked (Not Yet Built)

| Feature | Spec Doc | Status |
|---------|----------|--------|
| Banner Widget Section | `docs/BANNER_WIDGETS_SPEC.md` | **Spec Locked** |
| YouTube Persistent Player | `docs/BANNER_WIDGETS_SPEC.md` Section 1 | **Spec Locked** |
| GitHub Activity Widget | `docs/BANNER_WIDGETS_SPEC.md` Section 2 | **Spec Locked** |
| Worthy Reads Widget | `docs/BANNER_WIDGETS_SPEC.md` Section 4 | **Spec Locked** |
| Turntable Loading Page | `docs/TURNTABLE_LOADING_SPEC.md` | **Spec Locked** |
| Alan Iverson Chat Persona | `docs/ALAN_IVERSON_SPEC.md` | **Spec Locked** |
| Human/Machine Toggle | `docs/HUMAN_MACHINE_TOGGLE_SPEC.md` | **Spec Locked** |
| Navigation Pathways + Vinyl Grid | `docs/NAVIGATION_PATHWAYS_SPEC.md` | **Spec Locked** |

### Parking Lot (Ideas, Not Scoped)

- Turntable loading screen
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
- **Not a SaaS product** -- single-candidate portfolio, not a platform

---

## User Stories

### Recruiter / Hiring Manager

1. **As a recruiter**, I want to paste a job description and get an honest fit assessment so I know whether to reach out.
2. **As a hiring manager**, I want to ask the AI specific questions about Keegan's experience so I can evaluate depth beyond bullet points.
3. **As a recruiter**, I want to browse the career timeline chronologically so I can quickly understand the career arc.
4. **As a hiring manager**, I want to see publications and research credentials so I can assess the science background claim.

### Visitor / Collaborator

5. **As a visitor**, I want to see what records Keegan recently bought so I get a sense of personality beyond work.
6. **As a collaborator**, I want to find LinkedIn/GitHub/Substack links so I can connect on other platforms.
7. **As a visitor**, I want the site to load fast and look good on my phone so I can browse during a commute.

### Keegan (Operator)

8. **As the operator**, I want AI behavior tuned via `ai_instructions` table so I can adjust tone without redeploying code.
9. **As the operator**, I want PostHog tracking on every interaction so I can see what visitors actually do.
10. **As the operator**, I want the AI to lead with value and only acknowledge gaps when directly asked.

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
| Discogs live | Recent Digs shows real data | 5 records from lecturesfrom collection |

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

1. **Worthy Reads data source** -- JSON config file, Supabase table, or manual entry? (per `BANNER_WIDGETS_SPEC.md`)
2. **Alan Iverson art style** -- Street 3D or 60s Comic? Both prototyped in Aura, winner TBD.
3. **Navigation redesign** -- Current top nav vs. fixed left sidebar (per `FRONTEND_GUIDELINES.md` and `docs/NAVIGATION_PATHWAYS_SPEC.md`). When to ship?
4. **YouTube playlist integration** -- Does turntable need to ship before the banner YouTube player? Or can banner player stand alone?

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
