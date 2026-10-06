# Frontend Guidelines — lecturesfrom.com Portfolio

**Last Updated:** 2026-10-06
**Supersedes:** `docs/DESIGN_PLAYBOOK.md` (archived -- all content folded into this doc)
**CSS Framework:** Tailwind CSS 3.4.19 + CSS Custom Properties
**Fonts:** Google Fonts (Chakra Petch, Doto, Space Grotesk, Roboto Mono, Roboto Slab)

---

## Visual Direction

**Brand essence:** Authentic. Passionate. Professional with easter eggs.

**Energy:** Could have a million layers if you kept clicking, but the surface is clean and witty enough to create its own lane.

**Aesthetic:** Hip-hop / zine / street culture influence. Organized chaos -- dense but navigable. Hand-drawn energy, DIY, graffiti-adjacent. Not corporate. Not generic dark mode template. A person you'd want to grab coffee with.

**First impression goal (3 seconds):** "What's happening here? I want to keep looking." Not impressed. Not sold. **Intrigued.**

**Two visual dialects. Do not homogenize.**

- **House** (`/`, `/catalog`, `/collection`, `/legal`): near-black `#0a0a0a`, grotesque / tight-tracked meta, one accent = print orange `#e23d00`. Display face is Chakra Petch 600 (wordmark, page-title h1/h2, `.house-spine-title`). Body on `.house` stays Space Grotesk. Meta stays Roboto Mono. Hairlines. No terminal chrome. No lime spray type. Display name always lowercase `lecturesfrom` (`lecturesfrom LLC` allowed in footer/legal). The last `o` in the root wordmark is the static `LogoMark` — geometry and stroke width traced from the owner line-only PNG (outer circle, tilted ellipse, stem + flag, angle pie, wedges as a sector of the inner arc that meets the ring at the green ray). The only variant is `'line'` (ink strokes, no fills). Fill regions stay named (`--lf-mark-*` / `data-lf-region`, default `transparent`) so a later token map is a CSS-variable swap. No white disc. Sized so the circle's outer ink hits Chakra Petch 600 x-height (`0.498em`); there is no standalone coin above the wordmark. Favicon / og remain the older line-mark (untouched this pass).
- **Person** (`/keeganmoody33`): existing lime/orange terminal and Space Grotesk. Untouched except the wordmark becoming a SignalCut link to `/`. Do not apply house display type or house light tokens here.

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

### House tokens (v3, Sep 27 2026)

Dark is the live default on `.house` and on `html:has(.house)` (body and the scrollbar sit outside `.house`, so the six core colors are mirrored there). Light swaps those six when `data-theme="light"` is on `.house` (`html:has(.house[data-theme="light"])` mirrors them). No house control sets that attribute yet. Person light mode (`[data-theme="light"]` on the document, warm paper / olive) is a different palette.

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--house-bg` | `#0a0a0a` | `#ffffff` | Page background |
| `--house-ink` | `#ececec` | `#0a0a0a` | Primary text |
| `--house-muted` | `#8a8a8a` | `#666666` | Meta labels |
| `--house-dim` | `#7a7a7a` | `#757575` | Catalog numbers, footer nav |
| `--house-line` | `#242424` | `#e3e3e3` | Hairlines only |
| `--house-orange` | `#e23d00` | `#d73100` | The one key: hover, issue plates |

Add-ons are the same in both modes. Defined, not applied to chrome. Cobalt has no job. Cable colors are for system diagrams only.

| Token | Value | Usage |
|-------|-------|-------|
| `--house-stripe-red` | `#ea4d30` | 1980 stripe |
| `--house-stripe-orange` | `#ec7c3a` | 1980 stripe |
| `--house-stripe-amber` | `#f1ac4b` | 1980 stripe |
| `--house-key` | `#eca50b` | Open-window key |
| `--house-lcd` | `#afc875` | LCD chip background |
| `--house-lcd-ink` | `#0a0a0a` | Text on the LCD chip |
| `--house-pad` | `#7f8085` | Hardware surfaces |
| `--house-cable-audio` | `#b8c95e` | System diagrams |
| `--house-cable-usb` | `#49b0d3` | System diagrams |
| `--house-cable-midi` | `#ca77b3` | System diagrams |
| `--house-cobalt` | `#2842ba` | No job yet |

Named fill regions live on `.house-logo-mark` as `--lf-mark-*` (and `data-lf-region` on the SVG). Defaults are `transparent`. Geometry / stroke width are the owner line-only PNG trace. The only variant is `line`. A later token map assigns these vars — not new geometry.

**`line`** — no visible fills. Every stroke `currentColor` (ink). Stroke width 0.018107 of ring radius (source ring: 8.25px on 455.625px midline) — proportional hairline; the o fades on phones. Do not apply `vector-effect: non-scaling-stroke` or a CSS px clamp. Ellipse ry=0.4115 at −57.87°, centre (−0.016, 0) in unit space; rays meet (−4, −3) viewBox units from the ring centre. Outer ring is ink.

| Region (`data-lf-region`) | CSS var | Default | Role |
|--------------------------|---------|---------|------|
| `ellipse` | `--lf-mark-ellipse` | `transparent` | Tilted ellipse |
| `wedge-up-in` | `--lf-mark-wedge-up-in` | `transparent` | Upper wedge inside the ellipse |
| `wedge-up-out` | `--lf-mark-wedge-up-out` | `transparent` | Upper wedge outside the ellipse |
| `wedge-low-in` | `--lf-mark-wedge-low-in` | `transparent` | Lower wedge inside the ellipse |
| `wedge-low-out` | `--lf-mark-wedge-low-out` | `transparent` | Lower wedge outside the ellipse |
| `angle` | `--lf-mark-angle` | `transparent` | Angle pie |
| `square` | `--lf-mark-square` | `transparent` | Flag square |
| Ring interior | — | — | Not a fill |

| Token | Value |
|-------|-------|
| `--house-font-display` | Chakra Petch |
| `--house-font-mono` | Roboto Mono |
| `--house-font-lcd` | Doto |
| `--house-font-sans` | Space Grotesk |

---

## Design Tokens -- Typography

### Font Stack

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| House display | Chakra Petch | 600 (400 and 700 loaded) | Wordmark, house page-title h1/h2, `.house-spine-title`. Tracking `-0.01em`. |
| House body | Space Grotesk | 300, 400, 500, 600, 700 | Base on `.house`. Person headings and body. |
| House LCD | Doto | 800 on `.house-lcd` (variable 100–900 loaded) | Sampler screen and lab readouts. No screen UI uses it yet. |
| UI / Code / Metadata | Roboto Mono | 300, 400, 500 | Tech pills, nav items, timestamps, buttons, house meta |
| Accent (available) | Roboto Slab | 300, 400, 500, 600 | Loaded but minimally used currently |

### Tailwind Font Families

```
font-space: 'Space Grotesk', sans-serif              ← person body, and the base on .house
font-display: var(--house-font-display), sans-serif ← house display (Chakra Petch)
font-mono: 'Roboto Mono', monospace                 ← technical elements
font-slab: 'Roboto Slab', serif                     ← accent use
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

1. Person headlines in Space Grotesk Bold. House page titles use `font-display font-semibold tracking-[-0.01em]` (Chakra Petch 600).
2. Body in Space Grotesk Regular -- readable, friendly. House running text and meta stay Roboto Mono.
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
- **Player (YouTubePlayer):** `w-6 h-6` play button, track info truncated, expand-on-hover for prev/next/volume. Hidden iframe wrapper is `inert` + `aria-hidden`; `onReady` sets `getIframe().tabIndex = -1`. Visible controls stay outside that wrapper. Skippable playback errors (2/5/100/101/150) advance with `nextVideo()`; only a real `onError` increments the streak. Three in a row (or playlist length if shorter) drop the slide. After a skip the stall deadline is 10s (`YT_STALL_TIMEOUT_MS`); the first BUFFERING/CUED/new video id extends it to a hard cap of `errorTime + 25s` (`YT_STALL_CAP_MS`). Churn does not extend past the cap. Only PLAYING (or unmount/drop) clears it. While the stall is armed the Play control is `aria-disabled` + `aria-busy` (not `disabled`), dimmed, `cursor-not-allowed` with no hover lime, the title reads "Track unavailable, skipping…", the author is blank, and the time readout is blank. On drop, arm the handoff only if `document.activeElement` is still inside the banner rotator (Now Playing slide or `[data-banner-dots]`) — never when focus is `body`, never for nav. Always `focus({ preventScroll: true })`. The landing target is the next visible slide panel (never a rotator dot, never Play/Pause), the rotator root (`tabIndex={-1}`) if that slide has no control, or the first nav control after the leftover slide is active. `NowPlayingLiveRegion` mounts empty `#yt-now-playing-live` on the career page at load (`sr-only`); drop only writes the text.
- **Min height:** `min-h-12` on every banner panel so rotation does not shift content

### Grid Background

Animated 60px x 60px grid pattern on body:
- Lines: 1px, `var(--grid-line)` color
- Animation: `gridShift` 8s linear infinite (shifts background position)
- Grid cells intentionally match album cover proportions (1:1)

---

## Component Patterns

### Rules for All Components

1. Person-page components in `components/` are `'use client'`. House components in `components/house/` are Server Components by default (`LogoMark` included). Do not add `'use client'` to the title card just to host the mark. `MotionSwitch` is the house client exception; `HouseFooter` does not currently render it.
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
| `.house-meta` | House metadata | Roboto Mono, 0.625rem, 0.22em tracking, uppercase, `--house-muted`. Lives in `@layer components` so utilities (active-tab ink) can override. `[aria-selected=true]` is ink. |
| `.house-source` | Source lines | Roboto Mono, 0.625rem, 0.16em tracking, lowercase, `--house-dim`. Use for every source (`discogs`, `musicbrainz`) and for the checked-no-match empty line. Links use `min-h-6` so the target is ≥24px without changing the type. |
| `.house-credit` | Discogs TOU line | Same size/family/dim as `.house-source`, **no** `text-transform`. Exact string `Data provided by Discogs.` linking the pressing URL (detail) or the lecturesfrom collection page (grid). No `nofollow`. |
| `.house-skip` | Skip to content | Same family/size/tracking as `.house-source`, ink on house bg. Visually hidden (`clip-path`) until focused. |
| `.house-text-button` | Collection crate text controls | Roboto Mono, 0.625rem, 0.16em tracking, uppercase, `--house-muted` `#8a8a8a`. Ink `#ececec` on `:focus-visible`. Orange `#e23d00` on hover only. `min-h-6` (24px). No fill, radius, or new colors. |
| `.house-lcd` | LCD chip | `--house-lcd` on `--house-lcd-ink`, Doto 800, `10px 16px` padding. Defined, unused. |
| `.house-rail` | House top rail | Three columns; atl / issue / year always visible; gutters `px-6 sm:px-10` |
| `.house-wordmark` | Root lockup | Chakra Petch 600, tracking `-0.01em`, `line-height: 0.85`. `min(11.5rem, 16.5cqi)` so `lecturesfrom` keeps the Space Grotesk width (0.961 of `min(12rem, 17.2cqi)`). Entrance is a 700ms opacity fade (`houseLockup`). Last `o` in `from` is a static `LogoMark` (owner line-only PNG trace; `variant` default `'line'` on this branch) over an in-flow transparent o (advance from the glyph; circle outer ink fills x-height `0.498em`). Full word is `.sr-only`; painted run is `aria-hidden`. Instant under `prefers-reduced-motion`. Slot `overflow-x: clip`. Nameplate and Hathaway SVGs are not mounted. |
| `.house-wordmark-o` | Wordmark o slot | `position: relative` inline. In-flow transparent `o` keeps glyph advance + tracking. Circle outer ink (500.491 of 512 viewBox; scale 248, stroke 0.018107 from the PNG ring) fills x-height `0.498em` and sits on the baseline (`bottom: descent − x-height × 5.755/500.491`; box `x-height × 512/500.491`). Height wins. Nudged `0.006em` right of the glyph center. No `overflow: hidden`. `LogoMark` `variant="line"`. No `LogoGlobe`. Wrapper is a `span`. Mark is `pointer-events: none`. |
| `.house-logo-mark` | Root mark box | `display: block` `span`, `2rem` square, `aspect-ratio: 1`, reserves size before paint. `--lf-mark-*` default `transparent`. `data-lf-variant="line"`. Wordmark o overrides to `calc(0.498em * 512 / 500.491)` via `.house-wordmark-o-mark`. Stroke is the SVG user-unit hairline (`LF_MARK_STROKE_WIDTH` 0.018107), not a CSS px clamp. |
| `.lf-logo-globe` | Logo mark box | Kept for restore. Square `aspect-ratio: 1`; `perspective: 8rem`. Currently unmounted (`LogoGlobe.tsx` stays; TitleCard and HouseWordmark do not render it). |
| `.lf-logo-globe-spin` | Coin spin | Kept for restore. `rotateY(0→360deg)` 12s linear infinite. Pauses on `html[data-lf-signal-cut="active"]` or `html[data-logo-paused="true"]`. Not applied while the wordmark o is static. |
| `.lf-motion-switch` | Footer Motion | Kept in `MotionSwitch.tsx`. HouseFooter does not render it while the o is static. Preference CSS, head bootstrap, and sessionStorage remain. |
| `.lf-logo-globe-core` | Core layer | Face-on rest pose. `animation: none; transform: none`. No independent spin. |
| `.house-spine` | Crate row | 3 columns below `sm` (format/catno on a second title line); 5 columns from `md` |
| `.house-fade` | Record detail entrance | Reuses `houseLockup` (700ms opacity). Instant under `prefers-reduced-motion`. No shimmer, no spinner. |


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
| `houseLockup` | 700ms | ease-out both | Root wordmark opacity fade (`0` → `1`). No letter-spacing. Instant under `prefers-reduced-motion`. Also used by `.house-fade` on record detail. |
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
- **Collection crate controls:** Under the `{n} releases` line, `shuffle` and `pull one` as `.house-text-button`. Shuffle is client Fisher-Yates of the whole grid (reload = ISR order; no animated reflow). Pull one uses the overlay/route. Keyboard only works; shuffle is hidden without JS; pull one is a link to an ISR-picked listed id.
- **Record detail:** house dark only. At 1280, cover left and rows right. At 375 and 768, stacked; cap the cover at `max-w-[480px]` so the title is on the first screen. Hairlines between sections. No cards, radius, or shadows. Title is Chakra Petch 600 tracking `-0.01em`, Discogs case untouched. Artist muted on its own line. `overflow-wrap: anywhere` on the h1, artist line, fact values, and missing-cover catno. Description Space Grotesk (inherit house sans — do not add `font-sans`, which is the system stack). Labels `.house-meta`. After the fact rows: lowercase `.house-source` `discogs` plus exact-case `.house-credit` `Data provided by Discogs.`, both linking `facts.discogsUrl` (not the homepage, no `nofollow`). `/collection` repeats that credit on the `{n} releases` count line **and** at the bottom of the grid, both to `https://www.discogs.com/user/lecturesfrom/collection`. Discogs API non-affiliation / Zink Media trademark sentence is a short `/legal` Data sources block in `--house-muted` (no new colors); HouseFooter does not carry it; `/legal.md` is the twin. Tabs OVERVIEW / TRACKS: active ink + 1px ink underline (`[aria-selected=true]`), inactive muted, hover orange. Both tab panels (`tabIndex={0}`) use the house 2px ink focus outline (`focus-visible:outline-2 outline-offset-2 --house-ink`), not Chrome’s default rounded ring. Selected track title is ink; other playable titles muted. Credits block is headed by the track title as an `h2`. Cover is square, same thumbnail as the grid, 1px `--house-line` (`#242424`) border, no radius or shadow. Orange is hover only — never the active tab, never a fill. Empty copy: `nothing on file yet` / `pick a track for credits and samples` / `{reason} · checked YYYY-MM-DD` / `couldn't reach discogs`. After a check, unresolved tracks and empty Overview connections render **only** the checked-no-match line — no extra `nothing on file yet` blocks. Missing cover is `#242424` with catno centered in house ink `#ececec` (13.1:1), never dim `#7a7a7a` (3.62:1 on that square). Store-down / no-Redis detail: fill the h1 from catno or id, show that catno in the square, and render **only** the dim mono `couldn't reach discogs` line plus retry — no tabs, no empty sections.

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

- Images have `alt` attributes. Collection grid covers use `alt=""` (caption is the accessible name). Record detail cover keeps `${artist} — ${title}` and loads `eager` / `fetchPriority=high`.
- The wordmark-o `LogoMark` is `decorative` (`aria-hidden` + `focusable="false"`) so the `h1` wordmark is the only accessible name. The wordmark keeps a `.sr-only` full word `lecturesfrom`; the painted run is `aria-hidden`. Group ids omitted. Standalone `LogoMark` uses pass `decorative={false}` (`<title>` lecturesfrom).
- HouseFooter does not render the Motion switch while the wordmark o is static. `MotionSwitch.tsx`, pause CSS, and the root layout head script stay in the repo for restore. `/keeganmoody33` does not share this footer (marquee / `gridShift` remain).
- External links have `target="_blank"` and `rel="noopener noreferrer"`. House source links use `min-h-6` so the target is at least 24px.
- Form submission via Enter key (Chat)
- Disabled states on buttons during loading
- Theme toggle buttons have `title` attributes
- Lazy loading on images (`loading="lazy"`)
- HouseShell skip-to-content (`.house-skip`) is visually hidden until focused, then jumps to `#house-content` (`tabIndex={-1}` so the skip target and page-mode Escape can take focus). Collection overlay: first Escape clears a selected track, second closes (`router.back()`) and restores `#crate-cover-{id}` or `#crate-pull-one`. While the overlay is open, `[data-collection-root]`, `.house header`, `.house footer`, and `.house-skip` are `inert`. Page mode Escape and close always `router.push('/collection')` (never `history.back()`), after the same track-first Escape, then focus `main#house-content` (`#house-content:focus-visible { outline: none }` — a 2px ink ring drew a line under the header and cut text at 375; house hairline is 1px `#242424`). Overlay-only autofocus on `collection`. Both OVERVIEW/TRACKS panels stay mounted (`hidden` + `tabIndex={0}` on the inactive) and use the house 2px ink focus outline. Track rows expose `aria-expanded` / `aria-controls` (no `aria-pressed`). Selected title is an `h2` over the extras. Overlay detail does not apply `.house-fade`; dim meta is `opacity-100` so scanners do not flag a 700ms fade. Page-mode `.house-fade` rests at `opacity: 1` so dim text stays `#7a7a7a` (4.61:1). Missing-cover catno on `#242424` is `--house-ink` `#ececec` (13.1:1).

### What's Missing (Improvement Areas)

- No ARIA labels on most interactive elements
- No keyboard navigation beyond default browser behavior
- No focus visible indicators beyond browser defaults
- Hover-only interactions on Publications (no keyboard alternative)
- No `aria-live` regions for dynamic content (chat messages, analysis results). Exception: `NowPlayingLiveRegion` renders an empty polite live region (`#yt-now-playing-live`, `sr-only`) on the career page at load; drop writes "Now Playing unavailable". Tailwind safelists `sr-only` and scans `components/` (not `lib/`) so the live region is hidden without emitting unused utilities from catalog prose.
- Activity sidebar: no keyboard trigger, no escape-to-close
- Color contrast may not meet WCAG AA in light mode (needs audit)

---

## Dark/Light Mode

- **Strategy:** Tailwind `class` dark mode + `data-theme` attribute on root for the person palette. House light is separate: `data-theme="light"` on `.house`.
- **Default:** Dark mode
- **Toggle:** Person theme buttons live in the Activity Stream sidebar. House has no toggle.
- **Persistence:** None currently (resets on page load)
- **Implementation:** Person CSS custom properties swap when `[data-theme="light"]` is set on the document. House core colors swap on `.house[data-theme="light"]` and `html:has(.house[data-theme="light"])`. Add-on house colors do not swap.

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
