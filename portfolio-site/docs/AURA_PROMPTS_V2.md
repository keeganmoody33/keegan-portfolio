# Aura Prompts v2 — With Design System

**Updated:** Feb 3, 2026
**Design System:** Current Live (Dark + Lime + Orange)

---

## How to Use Aura.build

1. Go to [aura.build](https://aura.build)
2. Start a new project
3. Paste the **Design System Prompt FIRST** (Prompt 0)
4. Then run each component prompt in order
5. Iterate until it looks right
6. Export as HTML/Tailwind
7. Drop the export back here

---

## Prompt 0: Design System Foundation (RUN THIS FIRST)

```
Create a design system for a portfolio website called "lecturesfrom"

DUAL THEME SYSTEM (Light + Dark modes):

DARK MODE TOKENS:
- Background Body: #121212 (true dark)
- Background Surface: #1E1E1E (cards, modals)
- Border Dim: #333333 (subtle dividers)
- Text Bright: #FFFFFF (headlines)
- Text Main: #C9C9C9 (body)
- Text Muted: #8B8B8B (secondary)
- Shadow Color: #CCFF00 (lime shadows on dark)

LIGHT MODE TOKENS:
- Background Body: #F5F1E6 (warm paper)
- Background Surface: #FFFFFF (cards, modals)
- Border Dim: #121212 (ink black)
- Text Bright: #121212 (headlines)
- Text Main: #333333 (body)
- Text Muted: #666666 (secondary)
- Shadow Color: #121212 (black shadows on paper)

SHARED ACCENTS (both modes):
- Accent Lime: #CCFF00 (primary CTAs, highlights, energy)
- Accent Lime Dim: rgba(204, 255, 0, 0.15) (subtle backgrounds)
- Accent Orange: #FF5F1F (secondary accent, Ask AI, warmth)
- Accent Blue: #2952FF (links, info - especially light mode)
- Accent Red: #FF3131 (errors, warnings)

TYPOGRAPHY:
- Headings: Space Grotesk, 700 weight
- Body: Space Grotesk, 400 weight
- UI/Code: Roboto Mono, 400 weight

SPACING: 4px base, scale: 4, 8, 12, 16, 24, 32, 48, 64, 96

EXISTING PATTERNS:
- Sketch buttons: offset shadow (5px 5px 0px 0px lime), moves on hover
- Ask AI buttons: dashed orange border
- Cards: surface bg, dim border, lime border on hover
- Tech pills: mono font, dim border, subtle

GRID BACKGROUND (critical, two pattern options):
- LINES: Subtle square grid, 1px strokes, cells are SQUARE (1:1 ratio)
- DOTS: Dot matrix pattern, 1.5px dots, 24px spacing
- Toggle between patterns independent of light/dark mode
- Grid is the foundation for navigation — cells align with album covers
- Projects section: grid cells become vinyl tiles (zoom-in transition)
- Grid = scaffolding, not just decoration

PHILOSOPHY:
- Still until engaged (no ambient motion)
- Sparse surface, dense on interaction
- First impression: intrigued, want to keep looking
- Use spacing over borders
- Lime for moments that matter, orange for personality

PERSONALITY LAYER (zine/hip-hop energy):
- Hand-drawn accent marks: underlines, circles, arrows, lightning bolts
- Bold, energetic lettering for emphasis (ALL CAPS headers when needed)
- Organized chaos: dense but navigable, controlled messiness
- Imperfect, human touches (not polished corporate)
- Layered collage hints: tape edges, margin annotations, paper texture subtle
- Visual emphasis: numbered badges, callout bubbles, diagonal lines
- Hip-hop/street culture influence: raw, authentic, DIY aesthetic

Base stays clean and dark. Personality comes through in marks, illustrations, and interaction moments.

Export as Tailwind config + CSS variables.
```

---

## Prompt 1: Site Shell

```
Using the lecturesfrom design system (Dark #121212 base, Lime #CCFF00 accent, Orange #FF5F1F secondary, Space Grotesk font):

Design a site shell/layout with:

1. FIXED LEFT SIDEBAR (desktop only)
   - Width: 240px
   - Logo at top (small, 24px, placeholder circle for now)
   - "lecturesfrom" wordmark below logo
   - 7 nav items vertically stacked:
     * Home
     * About
     * Experience
     * Personal Projects
     * Stack of Wax
     * Physical Products (greyed out, "coming soon")
     * Connect
   - Nav items: Roboto Mono, text-sm, muted color, lime on hover/active

2. TOP BANNER STRIP (marquee)
   - Height: 48px
   - Full width (right of sidebar)
   - Dark surface background
   - Scrolls horizontally (marquee), pauses on hover
   - Placeholder for widgets (just show scrolling placeholder content for now)

3. MAIN CONTENT AREA
   - Right of sidebar, below banner
   - Max-width: 1200px centered
   - Generous padding (space-16 on sides)

4. GRID BACKGROUND (always visible)
   - Subtle square grid covers entire viewport
   - Grid lines: #1E1E1E (barely visible, adds texture)
   - Grid cells are SQUARE — same proportions as album covers
   - This creates visual scaffolding: grid cells → album tiles when navigating to projects
   - Grid stays still, content moves over it

5. MOBILE: Sidebar becomes hamburger menu

Keep it minimal. No content yet, just the shell structure with grid foundation.

Export as HTML/Tailwind.
```

---

## Prompt 2: Banner Widgets

```
Using the lecturesfrom design system (Dark #121212 base, Lime #CCFF00 accent, Orange #FF5F1F secondary):

Design a banner widget strip (48px height) that SCROLLS horizontally (marquee style).

MARQUEE BEHAVIOR:
- Content scrolls left continuously
- PAUSES on hover (user can read/interact)
- Smooth, not jerky
- This matches the current live site behavior

WIDGETS (inside the marquee):

1. MUSIC PLAYER
   - Compact: album art thumbnail (32px), track name, play/pause button
   - Currently playing indicator (lime dot or waveform)
   - Roboto Mono for track info

2. GITHUB ACTIVITY
   - Retro vertical bar graph (7 bars for last 7 days)
   - 8-bit/pixel aesthetic
   - Lime colored bars on dark background
   - Small "GitHub" label

3. RECENT DIGS (Discogs)
   - Small vinyl thumbnail (32px)
   - Artist - Album title (truncated)
   - "Recent Dig" label

4. WORTHY READS
   - Link icon + article title (truncated)
   - Muted text, lime on hover

BEHAVIOR:
- Widgets separated by subtle vertical dividers
- Hover on any widget: slight background lift
- Overall: information-dense but clean

Export as HTML/Tailwind.
```

---

## Prompt 3: Vinyl Grid Overlay

```
Using the lecturesfrom design system (Dark #121212 base, Lime #CCFF00 accent, Orange #FF5F1F secondary):

Design a full-screen view for displaying projects as vinyl/album covers.

KEY CONCEPT: The site's background grid cells ARE the album tiles.
- When entering projects section, camera "zooms into" the grid
- Grid cells expand/fill with album artwork
- Transition feels like focusing on one part of the grid

CONTAINER:
- Full viewport
- Background grid still visible (dimmed at 95% opacity)
- Title at top: "Personal Projects" in Space Grotesk Bold

GRID:
- 4 columns desktop, 2 tablet, 1 mobile
- Gap matches the underlying grid line spacing
- Tiles snap to grid alignment

TILES (album cover style):
- Square (1:1 ratio) — SAME proportions as background grid cells
- Placeholder image fills tile
- Title overlaid at bottom with gradient fade
- ZINE ENERGY: hand-drawn marks, bold lettering, tape-edge hints, sticker vibes
- On hover:
  - Slight tilt/rotation (10-15 degrees, like pulling from a stack)
  - Scale up 1.03
  - Reveal: short description + 3-4 tech chips
  - Border glows lime subtly
  - Can reveal hand-drawn annotation (arrow, circle, underline)

Keep tiles feeling like physical records you'd flip through.

Export as HTML/Tailwind with hover animations.
```

---

## Prompt 4: Project Detail Page

```
Using the lecturesfrom design system (Dark #121212 base, Lime #CCFF00 accent, Orange #FF5F1F secondary):

Design a project detail page layout.

SECTIONS (vertical scroll):

1. HERO
   - Large project title (Space Grotesk Bold, text-5xl)
   - Tagline underneath (text-muted)
   - Category badge (chip style)
   - Hero image (album-cover style, can be wider)
   - ZINE ENERGY: hand-drawn underline on title, arrow pointing to key element, bold/imperfect feel

2. WHY I BUILT IT
   - Section header with lime accent line
   - Narrative paragraph (first-person, honest)
   - Max-width: 65ch for readability

3. TECHNICAL BREAKDOWN
   - Tech stack as horizontal chip row
   - Architecture notes (can include code blocks)
   - Roboto Mono for technical content

4. OUTCOME
   - What happened, did it ship, learnings
   - Honest about failures if any

5. LINKS
   - GitHub repo button
   - Live demo button (if applicable)
   - Styled as ghost buttons with lime border on hover

Overall: Long-form reading layout, generous whitespace, clear hierarchy.

Export as HTML/Tailwind.
```

---

## Prompt 5: Alan Iverson Chat

```
Using the lecturesfrom design system (Dark #121212 base, Lime #CCFF00 accent, Orange #FF5F1F secondary):

Design a chat interface with a mascot character.

CHAT CONTAINER:
- Modal or slide-in panel from right
- Dark surface background
- Header: "Ask Alan" with close button

CHARACTER AREA (right side of chat):
- Placeholder for "Alan" character (circle avatar for now)
- 75-85% opacity when idle
- Speech bubble capability

CHAT FLOW:
- First message from Alan: "We talkin' about practice. Not a game."
- Second bubble: "Alright—Keegan's got you. Ask away."
- Then standard chat interface

MESSAGES:
- User messages: right-aligned, lime background, dark text
- AI messages: left-aligned, surface background, bright text
- Timestamps in muted, text-xs

INPUT:
- Bottom of chat
- Dark input field with subtle border
- Send button (lime)

Keep it clean but with personality in the character area.

Export as HTML/Tailwind.
```

---

## Prompt 6: Theme Toggle (Light/Dark + Grid Pattern)

```
Using the lecturesfrom design system:

Design a compound toggle for switching themes and grid patterns.

TOGGLE STRUCTURE:
- Main container: horizontal pill shape, fixed bottom center, 24px from bottom
- TWO controls in one unit:

1. LIGHT/DARK TOGGLE (primary)
   - Two segments: sun icon (light) / moon icon (dark)
   - Active segment: lime background (#CCFF00), dark text
   - Inactive segment: transparent, muted text
   - Click switches entire site theme

2. GRID PATTERN TOGGLE (nested, smaller)
   - Small button inside or adjacent to main toggle
   - Two states: grid lines icon / dots icon
   - Switches background pattern independent of light/dark
   - More subtle than the main toggle

THEME DEFINITIONS:

LIGHT MODE:
- Background: #F5F1E6 (warm paper)
- Surface: #FFFFFF (cards)
- Text: #121212 (ink black)
- Borders: #121212
- Accents: Lime #CCFF00, Orange #FF5F1F, Blue #2952FF
- Shadows: hard, black (5px 5px 0px 0px #121212)

DARK MODE:
- Background: #121212 (true dark)
- Surface: #1E1E1E (elevated)
- Text: #FFFFFF / #C9C9C9
- Borders: #333333
- Accents: Lime #CCFF00, Orange #FF5F1F
- Shadows: hard, lime (5px 5px 0px 0px #CCFF00)

GRID PATTERNS (work in both modes):
- Lines: subtle square grid, 1px strokes
- Dots: dot matrix pattern, 1.5px dots, 24px spacing

SIZE:
- Main toggle: compact pill
- Grid toggle: small icon button (24px)
- Border-radius: full (pill)

BEHAVIOR:
- Toggles switch instantly
- Preference persists (localStorage)
- Subtle shadow to lift off page

This is a persistent UI element on all pages.

Export as HTML/Tailwind with CSS variables for theme switching.
```

---

## Prompt 7: Turntable Loading Page

```
Using the lecturesfrom design system (Dark #121212 base, Lime #CCFF00 accent, Orange #FF5F1F secondary):

Design a loading/entry page featuring a turntable.

LAYOUT:
- Full viewport, centered content
- True dark background (#121212)

TURNTABLE (placeholder):
- Large circular element representing turntable platter
- 45-degree perspective hint (subtle)
- Tonearm element pointing toward platter
- Sketch/line-art aesthetic (thin strokes, minimal fills)

INTERACTION HINT:
- Text below turntable: "Drop the needle" or similar
- Subtle pulse animation on the tonearm (invitation to click)

SKIP OPTION:
- Bottom corner, very small, muted text
- Says something like "I prefer silence" (not "skip")
- Makes user feel slightly lame for skipping

VIBE:
- Still until user engages
- Intriguing, makes you want to interact
- Sets the tone for the rest of the site

Export as HTML/Tailwind. Turntable itself is placeholder - we'll add 3D/Unicorn later.
```

---

## Prompt 8: Experience Timeline

```
Using the lecturesfrom design system (Dark #121212 base, Lime #CCFF00 accent, Orange #FF5F1F secondary):

Design a career timeline component.

LAYOUT:
- Vertical timeline with line on left
- Timeline nodes (small diamonds or circles) at each entry
- Content cards to the right of the line

TIMELINE ENTRY:
- Date range (Roboto Mono, text-sm, muted)
- Company name (Space Grotesk Bold, lime on hover, links out)
- Role title (text-sm, accent-orange #FF5F1F)
- Description bullets (body text)
- Tech stack chips at bottom of card

CARDS:
- Surface background
- Subtle border
- Hover: border shifts to lime subtly

SPACING:
- Generous vertical spacing between entries
- Timeline line: 1px, border color

Newest role at top, oldest at bottom.

Export as HTML/Tailwind.
```

---

## Prompt 9: Machine Mode View

```
Using the lecturesfrom design system (Dark #121212 base):

Design the "Machine Mode" version of content sections.

AESTHETIC:
- Terminal/markdown style
- Background: pure black (#121212)
- Text: monospace only (Roboto Mono)
- No gradients, no decorative elements

CONTENT RENDERING:
- Headers shown as: # Header or ## Subheader
- Links shown as: [Link Text](https://url)
- Lists use - or * bullets
- Code blocks with subtle background
- Tables use | pipe | separators |

EXAMPLE SECTION (About):
```
# About

Name: Keegan Moody
Role: GTM Engineer
Location: Atlanta, GA

## Skills
- Go-to-market infrastructure
- Sales automation (Clay, SmartLead, Apollo)
- AI/ML integration (Claude, MCP)

## Links
- [GitHub](https://github.com/keeganmoody33)
- [LinkedIn](https://linkedin.com/in/keeganmoody33)
```

This is raw, functional, developer-facing. Maximum information density.

Export as HTML/Tailwind.
```

---

## What to Deliver Back

After running prompts in Aura:

1. **Export HTML/Tailwind** for each component
2. **Screenshot** of what it looks like (optional but helpful)
3. **Drop the files here** or paste the code

I'll then:
- Extract components into your Next.js structure
- Wire up interactions and state
- Connect to Supabase where needed
- Integrate with existing codebase

---

## Execution Order

| Round | Prompts | What You Get |
|-------|---------|--------------|
| 1 | Prompt 0 + 1 | Design system + Shell |
| 2 | Prompt 2 + 3 | Banner + Vinyl Grid |
| 3 | Prompt 4 + 5 + 6 | Project Page + Chat + Toggle |
| 4 | Prompt 7 + 8 + 9 | Turntable + Timeline + Machine Mode |

Start with Round 1. Get the foundation right before details.

---

*Prompts v2.0 — Feb 3, 2026*
