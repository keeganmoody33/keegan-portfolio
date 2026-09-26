# Frontend Guidelines — lecturesfrom.com Portfolio

**Last Updated:** 2026-09-26
**Supersedes:** `docs/DESIGN_PLAYBOOK.md` (archived -- all content folded into this doc)
**CSS Framework:** Tailwind CSS 3.4.19 + CSS Custom Properties
**Fonts:** Google Fonts (Space Grotesk, Roboto Mono, Roboto Slab)

---

## Visual Direction

**Brand essence:** Authentic. Passionate. Professional with easter eggs.

**Energy:** Could have a million layers if you kept clicking, but the surface is clean and witty enough to create its own lane.

**Aesthetic:** Hip-hop / zine / street culture influence. Organized chaos -- dense but navigable. Hand-drawn energy, DIY, graffiti-adjacent. Not corporate. Not generic dark mode template. A person you'd want to grab coffee with.

**First impression goal (3 seconds):** "What's happening here? I want to keep looking." Not impressed. Not sold. **Intrigued.**

**Two visual dialects. Do not homogenize.**

- **House** (`/`, `/catalog`, `/collection`, `/legal`): near-black `#0a0a0a`, grotesque / tight-tracked meta, one accent = print orange `#E23D00`. Hairlines. No terminal chrome. No lime spray type. Display name always lowercase `lecturesfrom` (`lecturesfrom LLC` allowed in footer/legal).
- **Person** (`/keeganmoody33`): existing lime/orange terminal. Untouched except the wordmark becoming a SignalCut link to `/`.

**Information density:** Sparse surface, dense on engagement. First screen is clean, intriguing, spacious. Interaction reveals depth.

---

## Design Tokens -- Colors

### Dark Mode (`:root` -- default)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-body` | `#121212` | Page background |
| `--bg-surface` | `#1E1E1E` | Cards, modals, elevated surfaces |
| `--bg-glass` | `rgba(30, 30, 30, 0.95)` | Overlays, glass effect |
| `--border-dim` | `#333333` | Subtle dividers, card borders |
| `--border-highlight` | `#CCFF00` | Active states, focus rings |
| `--text-bright` | `#FFFFFF` | Headlines, primary text |
| `--text-main` | `#C9C9C9` | Body copy |
| `--text-muted` | `#8B8B8B` | Secondary, timestamps, labels |
| `--accent-lime` | `#CCFF00` | Primary CTA, highlights, energy |
| `--accent-lime-dim` | `rgba(204, 255, 0, 0.15)` | Subtle lime backgrounds |
| `--accent-orange` | `#FF5F1F` | Secondary accent, Ask AI, warmth |
| `--accent-red` | `#FF3131` | Errors, warnings, bold moments |
| `--grid-line` | `#1E1E1E` | Grid pattern lines |

### Light Mode (`[data-theme="light"]`)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-body` | `#E8E2D2` | Page background (warm paper) |
| `--bg-surface` | `#DCD5C3` | Cards, modals |
| `--bg-glass` | `rgba(220, 213, 195, 0.95)` | Overlays |
| `--border-dim` | `#C5BCAE` | Dividers, card borders |
| `--border-highlight` | `#4A5D23` | Active states, focus |
| `--text-bright` | `#2B241D` | Headlines (ink) |
| `--text-main` | `#42382F` | Body copy |
| `--text-muted` | `#857A6E` | Secondary, labels |
| `--accent-lime` | `#556B2F` | Primary accent (muted olive) |
| `--accent-lime-dim` | `rgba(85, 107, 47, 0.15)` | Subtle olive backgrounds |
| `--accent-orange` | `#CC4E18` | Secondary accent |
| `--accent-red` | `#D32F2F` | Errors |
| `--grid-line` | `#DCD5C3` | Grid lines |

### Color Rules

1. Lime is for moments that matter -- CTAs, active states, hover highlights
2. Orange is the personality -- Ask AI, secondary actions, playful moments
3. Red is rare -- only real errors or bold emphasis
4. Hard shadows flip: lime on dark (`#CCFF00`), dark on light
5. Dark mode is the primary experience; light mode is the alternative

---

## Design Tokens -- Typography

### Font Stack

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Headings + Body | Space Grotesk | 300, 400, 500, 600, 700 | H1-H3, hero text, paragraphs, descriptions |
| UI / Code / Metadata | Roboto Mono | 300, 400, 500 | Tech pills, nav items, timestamps, buttons |
| Accent (available) | Roboto Slab | 300, 400, 500, 600 | Loaded but minimally used currently |

### Tailwind Font Families

```
font-space: 'Space Grotesk', sans-serif   ← default body font
font-mono: 'Roboto Mono', monospace       ← technical elements
font-slab: 'Roboto Slab', serif           ← accent use
```

### Type Scale (from DESIGN_PLAYBOOK)

| Token | Size | Usage |
|-------|------|-------|
| `text-xs` | 0.75rem (12px) | Timestamps, fine print |
| `text-sm` | 0.875rem (14px) | Labels, secondary text |
| `text-base` | 1rem (16px) | Body copy |
| `text-lg` | 1.125rem (18px) | Lead paragraphs |
| `text-xl` | 1.25rem (20px) | Section intros |
| `text-2xl` | 1.5rem (24px) | H3 |
| `text-3xl` | 1.875rem (30px) | H2 |
| `text-4xl` | 2.25rem (36px) | H1 |
| `text-5xl` | 3rem (48px) | Hero text |
| `text-6xl` | 3.75rem (60px) | Display |

### Typography Rules

1. Headlines in Space Grotesk Bold -- confident, geometric
2. Body in Space Grotesk Regular -- readable, friendly
3. Anything technical (buttons, chips, code, labels) in Roboto Mono
4. Line height: 1.5 for body, 1.2 for headlines
5. Max body width: 65ch for readable line length
6. ALL CAPS for impact headers only

---

## Design Tokens -- Spacing

Using Tailwind defaults (4px base unit):

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` / `p-1` | 4px | Tight internal spacing |
| `space-2` / `p-2` | 8px | Tight groupings |
| `space-3` / `p-3` | 12px | Tight groupings |
| `space-4` / `p-4` | 16px | Component internal padding |
| `space-6` / `p-6` | 24px | Component internal padding (generous) |
| `space-8` / `p-8` | 32px | Section padding |
| `space-12` / `p-12` | 48px | Section separation |
| `space-16` / `p-16` | 64px | Major section separation |
| `space-24` / `p-24` | 96px | Page-level breathing room |

### Spacing Rules

1. Components have internal padding of `space-4` to `space-6`
2. Sections separated by `space-16` to `space-24`
3. Tight groupings use `space-2` to `space-3`
4. Generous whitespace is confidence. When in doubt, add space.

---

## Design Tokens -- Shadows, Borders, Radius

### Tailwind Custom Shadows

| Name | Value | Usage |
|------|-------|-------|
| `shadow-sketch` | `5px 5px 0px 0px #CCFF00` | Primary button resting state |
| `shadow-sketch-hover` | `7px 7px 0px 0px #CCFF00` | Primary button hover |
| `shadow-sketch-active` | `2px 2px 0px 0px #CCFF00` | Primary button active/pressed |

### Border Rules

- Primary separator: spacing (no border needed)
- When borders needed: 1px, low contrast (`var(--border-dim)`)
- Hover: border-color transitions to `var(--accent-lime)`
- Border radius: `2px` for pills/chips, `8px` for cards

---

## Layout Rules

### Page Structure

Single-page app. All content on one route (`/`). No multi-page navigation currently.

```
┌──────────────────────────────────────────────┐
│ BANNER (~68px total, all full-width)           │
│   ├── Marquee ticker         (py-2, ~28px)   │
│   └── BannerRotator          (py-2, ~40px)   │
│         rotates: Player / Digs / GitHub       │
├──────────────────────────────────────────────┤
│ Main Content (max-width container, centered)  │
│   ├── Nav Header                              │
│   ├── Hero (SprayText + CTA)                  │
│   ├── Timeline (id="experience")              │
│   └── JD Analyzer (id="projects")             │
│ Footer (id="contact") — sibling of <main>     │
├──────────────────────────────────────────────┤
│ Activity Sidebar (fixed right, conditional)   │
├──────────────────────────────────────────────┤
│ Chat Modal (overlay, conditional)             │
└──────────────────────────────────────────────┘
```

### Banner Rotator

The two widget layers (YouTubePlayer, GitHubActivity) live inside a `BannerRotator` that shows one at a time:
- **Component:** `components/BannerRotator.tsx`
- **Rotation:** 8-second auto-cycle, crossfade (500ms `transition-opacity`). Skipped when `prefers-reduced-motion: reduce` or when fewer than two panels are available.
- **Interaction:** Pauses on hover; dot indicators at right edge for manual switching. Dots stay usable under reduced motion.
- **Mounting:** All children stay mounted (critical for YouTubePlayer iframe audio continuity); inactive panels get `opacity-0 absolute pointer-events-none`, `aria-hidden`, and `inert` so keyboard focus cannot land on invisible controls
- **Height:** Every available panel wrapper is `min-h-12` so YouTube (41px) and GitHub (48px) do not shift the page when they swap.
- **Padding:** Rotator root has no horizontal padding so the widget bar/border is full-bleed. When dots are shown, panel *content* uses `pr-16` (`useBannerPanelPad`) so `/ 7d` clears the 24×24 dot hit areas (`right-3` + 24 + 4 + 24 = 64px). Visible dots stay `h-1.5 w-1.5`. One panel / no dots → no extra pad.
- **Failures:** Widgets call `useBannerAvailability`. A null/error/empty render drops that slide and its dot. One panel left → static, no dots. Zero panels left → rotator returns `null` (banner row collapses). `WidgetErrorBoundary` also reports unavailable on catch.
- **PostHog:** Fires `banner_panel_switched` on manual dot clicks with `from`/`to` labels

### Banner Widget Rules

All banner widgets follow the same compact pattern:
- **Padding:** `py-2` (8px vertical), consistent across all layers
- **Labels:** Inline with content (not stacked above), `text-[10px] uppercase tracking-wider`
- **Container:** `max-w-7xl mx-auto px-4`
- **Layout:** Single-row flex (`flex items-center gap-4`)
- **Border:** `border-b border-[var(--border-dim)]` between each layer
- **Chart (GitHubActivity):** `h-[24px]` bar chart, `flex-1` fills available space
- **Player (YouTubePlayer):** `w-6 h-6` play button, track info truncated, expand-on-hover for prev/next/volume. Hidden iframe wrapper is `inert` + `aria-hidden`; `onReady` sets `getIframe().tabIndex = -1`. Visible controls stay outside that wrapper. Skippable playback errors (2/5/100/101/150) advance with `nextVideo()`; three in a row (or playlist length if shorter) drop the slide. A skip that never reaches PLAYING/BUFFERING or a new video id counts toward that streak.
- **Min height:** `min-h-12` on every banner panel so rotation does not shift content

### Grid Background

Animated 60px x 60px grid pattern on body:
- Lines: 1px, `var(--grid-line)` color
- Animation: `gridShift` 8s linear infinite (shifts background position)
- Grid cells intentionally match album cover proportions (1:1)

---

## Component Patterns

### Rules for All Components

1. All components are `'use client'` (client components)
2. All components live in `portfolio-site/components/`
3. Functional components with hooks (no class components)
4. No inline styles -- always Tailwind classes or CSS custom properties
   - **Exception:** Dynamic values that depend on element index (e.g. staggered animation delays in `SprayText.tsx`, bounce delays in `Chat.tsx`) may use inline `style` when no Tailwind equivalent exists.
5. PostHog tracking on every interactive component
   - **Known gap:** `Publications.tsx` has no PostHog events. DOI links and citation links are untracked.

### Custom CSS Classes (globals.css)

| Class | Purpose | Key Styles |
|-------|---------|------------|
| `.sketch-btn` | Primary button | Offset lime shadow, moves on hover/active |
| `.ask-ai-btn` | "Ask AI" button | Dashed orange border, fills on hover |
| `.timeline-line` | Vertical timeline connector | Gradient from dim border to transparent |
| `.timeline-node` | Timeline dot | Rotated square with body-color ring |
| `.spray-char` | Spray paint character | Inline-block, blur → focus animation |
| `.experience-card` | Timeline experience card | Surface bg, dim border, lime on hover |
| `.tech-pill` | Technology tag | Roboto Mono, dim border, muted text |
| `.marquee-container` | Scrolling ticker | Flex, max-content, 40s scroll, pauses on hover; `animation: none` when `prefers-reduced-motion: reduce` |
| `.activity-stream` | Sidebar container | Glass bg, dim border, Roboto Mono |
| `.log-success` | Green log entry | `color: #4ADE80` |
| `.log-warn` | Orange log entry | `color: var(--accent-orange)` |
| `.log-info` | Muted log entry | `color: var(--text-muted)` |
| `.house-meta` | House metadata | Roboto Mono, 0.625rem, 0.22em tracking, uppercase |
| `.house-rail` | House top rail | Three columns; atl / issue / year always visible; gutters `px-6 sm:px-10` |
| `.house-wordmark` | Root lockup | `min(12rem, 17.2cqi)` so `lecturesfrom` fits its slot; 12rem cap on desktop |
| `.house-spine` | Crate row | 3 columns below `sm` (format/catno on a second title line); 5 columns from `md` |


### Button Patterns

**Primary (Sketch):**
- `bg` transparent, `border` dim, `shadow-sketch`
- Hover: lifts (-2px, -2px), shadow grows, text turns lime
- Active: presses (2px, 2px), shadow shrinks

**Ask AI (Orange CTA):**
- `border: 2px dashed var(--accent-orange)`, `bg` transparent
- Hover: fills with orange, border becomes solid
- Nav control is `inline-flex min-h-11 items-center` so the tap target is at least 44px without changing padding or type

**Ghost (Secondary):**
- `bg` transparent, `border` dim
- Hover: `bg` elevated surface

**Send/Submit (Lime Fill):**
- `bg: var(--accent-lime)`, `color: var(--bg-body)` (inverted for contrast)
- Used in `Chat.tsx` for the send button
- Hover: slightly brighter lime
- Disabled: reduced opacity

### Card Pattern

- `bg: var(--bg-surface)`
- `border: 1px solid var(--border-dim)`
- `border-radius: 8px`
- `padding: space-6`
- Hover: `border-color: var(--accent-lime)`

---

## Animations

### Defined Keyframes

| Animation | Duration | Timing | Usage |
|-----------|----------|--------|-------|
| `gridShift` | 8s | linear infinite | Body grid background movement |
| `sprayStroke` | 0.15s | cubic-bezier(0.25, 0.46, 0.45, 0.94) | Hero name character reveal |
| `marquee` | 40s | linear infinite | Horizontal ticker scroll |
| SIGNAL CUT first | 420ms | tear 0–60 / snow 60–280 / black 280–360 / fade 360–420 | House <-> person, first crossing in the tab |
| SIGNAL CUT repeat | 160ms | tear 0–40 / black 40–120 / fade 120–160 | Later crossings in the same tab |
| SIGNAL CUT reduced | 80ms | instant black, no tear/snow/id/fade | `prefers-reduced-motion: reduce` |
| Marquee (reduced) | — | animation none | `prefers-reduced-motion: reduce` |
| Banner rotate (reduced) | — | no auto-cycle; dots/manual still work | `prefers-reduced-motion: reduce` |

Tear easing: `cubic-bezier(0.7, 0, 0.84, 0)`. Reveal easing: `cubic-bezier(0.2, 0, 0, 1)`. Overlay `z-index: 2147483647`, `pointer-events: none`. Id color `#d9d9d9`, arrow `#E23D00`.

`components/SignalCut.tsx` owns the overlay via a module-level `document.body` controller so the animation survives the route change. Do not mount it in `app/layout.tsx`. Phase deadlines are `setTimeout` from click `t0`; snow paint is rAF. Teardown is one idempotent function (stops snow, cancels timers/rAF, reverts `html` transform) called from every abort path including `visibilitychange` hidden — never `overlay.remove()` alone (Copilot 4111027402). Hold only if the destination pathname is still the origin at reveal-start.

### Motion Philosophy

**Still until engaged.** The site rests. User interaction wakes it up.

- Default state: calm, static, confident
- On interaction: elements respond with purpose
- Hover states: subtle lift, color shift
- Transitions: purposeful, not ambient
- Easter eggs: reward exploration, never obstruct

### Timing Tokens (from DESIGN_PLAYBOOK)

| Token | Value | Usage |
|-------|-------|-------|
| `duration-fast` | 150ms | Hover states |
| `duration-base` | 250ms | Most interactions |
| `duration-slow` | 400ms | Page transitions |
| `duration-slower` | 600ms | Dramatic entry moments |
| `easing-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard motion |
| `easing-bounce` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Playful moments |

---

## Responsive Breakpoints

Mobile-first approach using Tailwind defaults:

| Breakpoint | Width | Usage |
|------------|-------|-------|
| (default) | 0px+ | Mobile styles (base) |
| `sm:` | 640px | Small tablets |
| `md:` | 768px | Tablets / small laptops |
| `lg:` | 1024px | Desktop |
| `xl:` | 1280px | Large desktop |
| `2xl:` | 1536px | Extra large |

### House chrome (2026-09-26)

Two dialects. House pages (`/`, `/catalog`, sleeves, `/collection`, `/legal`) share one gutter: `px-6` (24px) / `sm:px-10` (40px). `HouseRail` owns that gutter. Do not nest another `px-6` around the rail on `/`.

- **Wordmark:** size to the content slot (`clamp` / `cqi`). Never `18vw` or a raw `12rem` that can overflow. Desktop cap stays `12rem`.
- **Spines:** format and catalog number stay visible at 375 (second meta line). Status column is the last grid track so it meets the hairline and the SPINES header. Do not leave empty `auto` tracks with `gap` when columns are `display: none`.
- **No-art Discogs tiles:** `NoArtTile` (hairline + artist/title in meta type). `IssuePlate` is for house sleeves only.

### Current Responsive Rules


Person-page components render the same layout across breakpoints.

| Component | Mobile | Desktop (md+) |
|-----------|--------|----------------|
| Career nav items | `whitespace-nowrap`; right group `gap-x-3 gap-y-2` | `sm:gap-x-8` |
| BannerRotator | Full-bleed bar; `pr-16` on content only when dots show | Same |
| All person-page components | Same layout | Same layout |

### Responsive Priorities (future)

1. Navigation: collapse to hamburger below `lg`
2. Sidebar: hidden below `xl`
3. Timeline cards: full-width on mobile, contained on desktop
4. Chat modal: full-screen on mobile, overlay on desktop

---

## Accessibility (Current State)

### What Exists

- Images have `alt` attributes
- External links have `target="_blank"` and `rel="noopener noreferrer"`
- Form submission via Enter key (Chat)
- Disabled states on buttons during loading
- Theme toggle buttons have `title` attributes
- Lazy loading on images (`loading="lazy"`)

### What's Missing (Improvement Areas)

- No ARIA labels on most interactive elements
- No keyboard navigation beyond default browser behavior
- No skip-to-content link
- No focus visible indicators beyond browser defaults
- Hover-only interactions on Publications (no keyboard alternative)
- No `aria-live` regions for dynamic content (chat messages, analysis results)
- Activity sidebar: no keyboard trigger, no escape-to-close
- Color contrast may not meet WCAG AA in light mode (needs audit)

---

## Dark/Light Mode

- **Strategy:** Tailwind `class` dark mode + `data-theme` attribute on root
- **Default:** Dark mode
- **Toggle:** Buttons in Activity Stream sidebar
- **Persistence:** None currently (resets on page load)
- **Implementation:** CSS custom properties swap all values when `[data-theme="light"]` is set

---

## Voice & Copy Guidelines

### Headlines

Not resume-speak. First-person, honest, specific.

| Instead of | Use |
|------------|-----|
| "Career Timeline" | "// Chronological Execution Log" |
| "Contact Me" | "Let's Build Something" or "Say What's Up" |
| "View Projects" | "The Work" or "What I've Shipped" |

### Tone

- Confident but not arrogant
- Specific, not vague
- Honest about failures
- Witty when natural, not forced
- Professional surface, personality underneath

---

## File Structure

All frontend code lives in `portfolio-site/`:

```
portfolio-site/
├── app/
│   ├── api/           → Route Handlers (proxy pattern)
│   ├── globals.css    → Design tokens, custom classes, animations
│   ├── layout.tsx     → Root layout, metadata, PostHog provider
│   ├── page.tsx       → Main page (all components rendered here)
│   └── providers.tsx  → PostHog provider wrapper
├── components/        → All UI components ('use client')
├── lib/               → Utilities (supabase.ts, posthog-server.ts)
└── docs/              → Feature specs, design references
```

---

## Related Docs

- [PRD.md](PRD.md) -- Product definition, features, scope
- [APP_FLOW.md](APP_FLOW.md) -- Route inventory and interaction flows
- [TECH_STACK.md](TECH_STACK.md) -- Locked dependencies and external services
- [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) -- Database schema, API contracts, Edge Functions
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) -- Phased build sequence
- [progress.txt](progress.txt) -- Current completion state
- [lessons.md](lessons.md) -- Mistakes and patterns to avoid

---

*Frontend Guidelines v1.0 -- Every visual decision locked down. AI references this for every component it creates.*
