# Codebase Audit — keegan-portfolio

**Audit Date:** 2026-02-10  
**Auditor:** CurtisCritical  
**Scope:** Full repository structure, components, pages, configs

---

## Repository Overview

**Type:** Next.js 14+ portfolio site with Supabase backend  
**Location:** `~/ClawWork/keegan-portfolio/`  
**Key Tech:** Next.js App Router, TypeScript, Tailwind CSS, Supabase, PostHog, YouTube IFrame API

---

## Directory Structure

```
keegan-portfolio/
├── portfolio-site/              # Main Next.js application
│   ├── app/                     # App Router pages
│   ├── components/              # React components
│   ├── lib/                     # Utilities (Supabase, PostHog)
│   ├── __tests__/               # Jest test suite
│   ├── docs/                    # Feature specifications
│   └── .next/                   # Build output
├── experiences/                 # Markdown career content
├── outputs/                     # Generated data exports
├── Mixmax/, Mobb_AI/, BCOFA/    # Project documentation
└── supabase/                    # Edge functions
```

---

## Components Inventory

| Component | Purpose | File |
|-----------|---------|------|
| **ActivityStream** | GitHub contribution graph | `components/ActivityStream.tsx` |
| **BannerRotator** | Rotating banner widgets | `components/BannerRotator.tsx` |
| **Chat** | AI chat interface | `components/Chat.tsx` |
| **GitHubActivity** | GitHub stats display | `components/GitHubActivity.tsx` |
| **JDAnalyzer** | Job description analyzer tool | `components/JDAnalyzer.tsx` |
| **Marquee** | Scrolling ticker | `components/Marquee.tsx` |
| **Publications** | Writing/publications list | `components/Publications.tsx` |
| **RecentDigs** | Discogs vinyl collection | `components/RecentDigs.tsx` |
| **SprayText** | Animated text effect | `components/SprayText.tsx` |
| **Timeline** | Career history display | `components/Timeline.tsx` |
| **YouTubePlayer** | Persistent music player | `components/YouTubePlayer.tsx` |

### Component Dependencies

```
Timeline
├── Uses: CSS variables (--text-main)
├── Data: public_bullets[] from experiences
└── Tested: Yes (Timeline.test.tsx)

BannerRotator
├── Uses: Widget rotation logic
├── Integrates: YouTubePlayer
└── Related: LEC-7, LEC-18

YouTubePlayer
├── Uses: YouTube IFrame API
├── Integrates: BannerRotator, Turntable loading page
└── State: sessionStorage for persistence

RecentDigs
├── Uses: Discogs API
├── API Route: /api/discogs
└── Related: Discogs widget feature
```

---

## Pages (App Router)

| Route | Page File | Purpose |
|-------|-----------|---------|
| `/` | `app/page.tsx` | Main portfolio page |
| `/api/chat` | `api/chat/route.ts` | AI chat API endpoint |
| `/api/discogs` | `api/discogs/route.ts` | Discogs data fetcher |
| `/api/jd-analyzer` | `api/jd-analyzer/route.ts` | Job description analyzer |

### Page Architecture

```
Layout (app/layout.tsx)
├── Providers (app/providers.tsx)
│   ├── PostHogProvider
│   └── SupabaseProvider
└── Page Content (app/page.tsx)
    ├── BannerRotator
    ├── Timeline
    ├── RecentDigs
    └── [other sections]
```

---

## Configuration Files

| File | Purpose | Key Settings |
|------|---------|--------------|
| `next.config.js` | Next.js config | Export, image optimization |
| `tailwind.config.js` | Tailwind CSS | Custom theme, colors |
| `tsconfig.json` | TypeScript | Strict mode, paths |
| `jest.config.js` | Test runner | jsdom environment |
| `vercel.json` | Vercel deploy | Build settings |
| `postcss.config.js` | PostCSS | Tailwind processing |

---

## API Routes

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/chat` | POST | AI chat completions | ✅ Active |
| `/api/discogs` | GET | Vinyl collection fetch | ✅ Active |
| `/api/jd-analyzer` | POST | JD parsing/analysis | ✅ Active |

---

## Documentation Files

| Doc | Purpose | Status |
|-----|---------|--------|
| `PRD.md` | Product requirements | ✅ Current |
| `TECH_STACK.md` | Technology choices | ✅ Current |
| `APP_FLOW.md` | User flow documentation | ✅ Current |
| `IMPLEMENTATION_PLAN.md` | Feature roadmap | ✅ Current |
| `BACKEND_STRUCTURE.md` | Database schema | ✅ Current |
| `FRONTEND_GUIDELINES.md` | UI/UX standards | ✅ Current |
| `docs/TURNTABLE_LOADING_SPEC.md` | Loading page spec | 🔒 Locked |
| `docs/BANNER_WIDGETS_SPEC.md` | Banner system spec | ✅ Current |
| `docs/ALAN_IVERSON_SPEC.md` | AI feature spec | ✅ Current |

---

## Database Integration

**Client:** `lib/supabase.ts`  
**Edge Functions:** `supabase/functions/`

| Function | Purpose |
|----------|---------|
| `chat/index.ts` | AI chat handler |
| `jd-analyzer/index.ts` | Job description analysis |

---

## Analytics Integration

**Provider:** PostHog  
**Setup:** `lib/posthog-server.ts`  
**Report:** `posthog-setup-report.md`

---

## Key External Integrations

| Service | Integration Point | Usage |
|---------|-------------------|-------|
| **YouTube** | IFrame API | Music playback (loading page + banner) |
| **Discogs** | API route | Vinyl collection display |
| **Supabase** | Client + Edge Functions | Database, auth, serverless |
| **PostHog** | React Provider | Analytics, session recording |
| **OpenAI** | API route | AI chat, JD analysis |

---

## Build System

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm test` | Jest test suite |
| `npm run lint` | ESLint checks |

---

## Testing Infrastructure

**Framework:** Jest + React Testing Library  
**Config:** `jest.config.js`, `jest.setup.js`  
**Coverage:**
- Timeline component ✅
- Snapshot tests ✅
- Room for expansion

---

## Known Patterns

### CSS Variables Usage
```css
--text-main       /* Primary text color */
--bg-main         /* Background color */
```

### Data Flow
1. Static content → Markdown files in `/experiences`
2. Dynamic content → Supabase/Edge Functions
3. Third-party → API routes (Discogs, YouTube)

### Component Conventions
- Functional components with TypeScript
- Props interfaces defined inline
- Tailwind for styling
- CSS variables for theme values

---

## Potential Areas for Cleanup

1. **Build cache** — `.next/` folder is large, should be gitignored (it is)
2. **Dev artifacts** — `portfolio-site/.next/dev/` shouldn't be committed
3. **Test coverage** — Only Timeline has tests currently
4. **Unused imports** — May exist in some components

---

## Summary Stats

| Metric | Count |
|--------|-------|
| Components | 11 |
| API Routes | 3 |
| Pages | 1 (app router) |
| Test Files | 1 |
| Docs | 10+ spec files |
| Edge Functions | 2 |

---

*Audit complete. Repository is well-organized, documented, and follows Next.js 14+ best practices.*
