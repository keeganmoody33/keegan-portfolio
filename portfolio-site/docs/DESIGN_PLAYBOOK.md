# Lecturesfrom Design Playbook

**Created:** Feb 3, 2026
**Version:** 1.0

---

## Brand Essence

**One line:** Authentic. Passionate. Professional with easter eggs.

**Energy:** Could have a million layers if you kept clicking, but the surface is clean and witty enough to create its own lane.

**Not:** Corporate portfolio. Resume website. Generic dark mode template.

**Is:** A person you'd want to grab coffee with. Depth beneath the surface. Rewards exploration.

---

## Visual DNA — Personality Layer

The foundation is clean and dark. The personality comes through in layered details.

### Influence: Hip-Hop / Zine / Street Culture

- **Organized chaos** — dense but navigable, controlled messiness
- **Hand-drawn energy** — imperfect, human, authentic (not polished corporate)
- **DIY aesthetic** — zine-like, graffiti-adjacent, raw
- **Layered collage hints** — tape edges, margin annotations, paper texture (subtle)

### Visual Marks (use as accents)

| Mark | Usage |
|------|-------|
| ⚡ Lightning bolts | Energy, power moments |
| 🔴 Circles/bubbles | Callouts, emphasis |
| ➡️ Arrows | Directional flow, process |
| Underlines | Hand-drawn emphasis on key words |
| Numbered badges | Lists, rankings, process steps |
| Diagonal lines | Dynamic movement, energy |

### Lettering Style (for headings, emphasis)

- Bold, chunky, confident
- ALL CAPS for impact headers
- Mix sizes for hierarchy
- Imperfect, human feel
- Can look like: sketchnotes, graphic recording, street poster

### How to Layer It

1. **Base:** Clean dark (#121212), grid scaffolding, minimal
2. **Personality:** Hand-drawn marks, bold lettering, texture hints
3. **When:** Hero sections, project covers, callouts, moments of emphasis
4. **When NOT:** Body copy, technical sections, Machine mode

The grid stays clean. The content on the grid can have raw energy.

---

## Color System

### Dual Theme System (Light + Dark)

Site supports both light and dark modes with a toggle. Grid pattern (lines or dots) is independently switchable.

#### DARK MODE

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-body` | `#121212` | Page background |
| `--bg-surface` | `#1E1E1E` | Cards, modals, elevated surfaces |
| `--bg-glass` | `rgba(30,30,30,0.95)` | Overlays, glass effect |
| `--border-dim` | `#333333` | Subtle dividers, card borders |
| `--border-highlight` | `#CCFF00` | Active states, focus |
| `--text-bright` | `#FFFFFF` | Headlines, primary text |
| `--text-main` | `#C9C9C9` | Body copy |
| `--text-muted` | `#8B8B8B` | Secondary, timestamps, labels |
| `--shadow-color` | `#CCFF00` | Hard shadows (lime on dark) |

#### LIGHT MODE

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-body` | `#F5F1E6` | Page background (warm paper) |
| `--bg-surface` | `#FFFFFF` | Cards, modals |
| `--bg-glass` | `rgba(245,241,230,0.95)` | Overlays |
| `--border-dim` | `#121212` | Dividers, card borders (ink) |
| `--border-highlight` | `#CCFF00` | Active states, focus |
| `--text-bright` | `#121212` | Headlines (ink black) |
| `--text-main` | `#333333` | Body copy |
| `--text-muted` | `#666666` | Secondary, labels |
| `--shadow-color` | `#121212` | Hard shadows (black on paper) |

#### SHARED ACCENTS (both modes)

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent-lime` | `#CCFF00` | Primary CTA, highlights, energy |
| `--accent-lime-dim` | `rgba(204,255,0,0.15)` | Subtle lime backgrounds |
| `--accent-orange` | `#FF5F1F` | Secondary accent, Ask AI, warmth |
| `--accent-blue` | `#2952FF` | Links, info (light mode especially) |
| `--accent-red` | `#FF3131` | Errors, warnings, bold moments |

### Grid Patterns (independent toggle)

| Pattern | Description |
|---------|-------------|
| **Lines** | Square grid, 1px strokes, subtle |
| **Dots** | Dot matrix, 1.5px dots, 24px spacing |

Both patterns work in both light and dark modes.

### Why This Works

- **Dark mode** — True dark, lets lime pop, developer/night vibe
- **Light mode** — Warm paper, zine/notebook feel, daytime readability
- **Lime (#CCFF00)** — Electric, works on both backgrounds
- **Orange (#FF5F1F)** — Warmth, personality
- **Blue (#2952FF)** — Extra pop in light mode

### Color Rules

1. Lime is for moments that matter — CTAs, active states, hover highlights
2. Orange is the personality — Ask AI, secondary actions, playful moments
3. Hard shadows flip: black on light, lime on dark
4. Red is rare — only for real errors or bold emphasis
5. Blue accent used more in light mode for links/info

---

## Typography

### Font Stack

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Headings | Space Grotesk | 700 | H1-H3, hero text, impact |
| Body | Space Grotesk | 400 | Paragraphs, descriptions |
| UI/Code | JetBrains Mono | 400 | Buttons, labels, code, tech elements |

### Type Scale

```css
--text-xs: 0.75rem;    /* 12px - timestamps, fine print */
--text-sm: 0.875rem;   /* 14px - labels, secondary */
--text-base: 1rem;     /* 16px - body copy */
--text-lg: 1.125rem;   /* 18px - lead paragraphs */
--text-xl: 1.25rem;    /* 20px - section intros */
--text-2xl: 1.5rem;    /* 24px - H3 */
--text-3xl: 1.875rem;  /* 30px - H2 */
--text-4xl: 2.25rem;   /* 36px - H1 */
--text-5xl: 3rem;      /* 48px - Hero */
--text-6xl: 3.75rem;   /* 60px - Display */
```

### Typography Rules

1. Headlines in Space Grotesk Bold — confident, geometric
2. Body in Space Grotesk Regular — readable, friendly
3. Anything technical (buttons, chips, code) in JetBrains Mono
4. Line height: 1.5 for body, 1.2 for headlines
5. Max width for body: 65ch (readable line length)

---

## Logo Usage

### Philosophy: "Subtle and intentional when necessary"

The orbital/satellite logo is a mark, not a mascot. It appears when it earns its place.

### Placements

| Context | Treatment |
|---------|-----------|
| Nav | Small (24px), monochrome, left of "lecturesfrom" |
| Favicon | 32x32, simplified |
| Loading page | Can be larger, animated, central moment |
| About page | Medium, intentional placement |
| Footer | Small, subtle watermark |
| Social/OG | Centered, with wordmark |

### Logo Colors

- Default: Monochrome (white lines on dark)
- Can use `--accent-primary` (lime) for special moments
- Never: Gradient, drop shadow, distortion

---

## Spacing System

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-24: 6rem;     /* 96px */
--space-32: 8rem;     /* 128px */
```

### Spacing Rules

1. Components have internal padding of `space-4` to `space-6`
2. Sections separated by `space-16` to `space-24`
3. Tight groupings use `space-2` to `space-3`
4. Let it breathe — generous whitespace is confidence

---

## Component Patterns

### Buttons

**Primary (Lime)**
```
bg: --accent-primary
text: --bg-deep (dark on lime)
hover: brightness 1.1
font: JetBrains Mono
```

**Secondary (Ghost)**
```
bg: transparent
border: --border
text: --text-main
hover: bg --bg-elevated
```

**Danger**
```
bg: --accent-danger
text: white
use: sparingly
```

### Cards

```
bg: --bg-surface
border: 1px solid --border
border-radius: 8px
padding: space-6
hover: border-color --accent-primary (subtle)
```

### Chips/Tags

```
bg: --bg-elevated
text: --text-muted
font: JetBrains Mono, text-xs
padding: space-1 space-2
border-radius: 4px
```

---

## Motion & Interaction

### Philosophy

**Still until engaged.** The site rests. User interaction wakes it up.

- Default state: calm, static, confident
- On interaction: elements respond, move, reward engagement
- Hover states: subtle lift, color shift, invitation to click
- Transitions: purposeful, not ambient
- Easter eggs: reward exploration, never obstruct

**Not nippori (always alive).** More like a confident person who speaks when spoken to.

### Timing

```css
--duration-fast: 150ms;
--duration-base: 250ms;
--duration-slow: 400ms;
--duration-slower: 600ms;
--easing-default: cubic-bezier(0.4, 0, 0.2, 1);
--easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Motion Rules

1. Most interactions: `duration-base` with `easing-default`
2. Hover states: `duration-fast`
3. Page transitions: `duration-slow`
4. Playful moments: use `easing-bounce`
5. Loading/entry: can be `duration-slower` for drama

---

## Voice & Copy

### Headlines

Not: "Career Timeline"
Yes: "The Receipts" or "Chronological Execution Log"

Not: "Contact Me"
Yes: "Let's Build Something" or "Say What's Up"

Not: "View Projects"
Yes: "The Work" or "What I've Shipped"

### Bullets/Copy

Not: Resume-speak ("Architected scalable solutions...")
Yes: First-person truth ("Built the system I wished existed...")

Inspired by: "Only selling what I truly believe in"

### Tone

- Confident but not arrogant
- Specific, not vague
- Honest about failures
- Witty when natural, not forced
- Professional surface, personality underneath

---

## Easter Eggs Philosophy

"Could have a million easter eggs if you kept clicking"

### Ideas

- Konami code triggers something
- Clicking the logo X times does something
- Hidden page at /practice (Alan Iverson reference)
- Machine mode has its own secrets
- Console.log has a message
- Certain hover combos reveal hidden elements

### Rule

Easter eggs reward curiosity but never obstruct. The site works perfectly without finding any.

---

## Responsive Breakpoints

```css
--screen-sm: 640px;
--screen-md: 768px;
--screen-lg: 1024px;
--screen-xl: 1280px;
--screen-2xl: 1536px;
```

### Mobile-First

1. Design for mobile first
2. Progressive enhancement for larger screens
3. Navigation collapses to hamburger below `lg`
4. Sidebar hidden below `xl`

---

## File Structure (Components)

```
components/
├── ui/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Chip.tsx
│   └── Toggle.tsx
├── layout/
│   ├── Shell.tsx
│   ├── Nav.tsx
│   ├── Banner.tsx
│   └── Footer.tsx
├── features/
│   ├── Turntable.tsx
│   ├── VinylGrid.tsx
│   ├── AlanChat.tsx
│   └── ModeToggle.tsx
└── brand/
    ├── Logo.tsx
    └── Wordmark.tsx
```

---

## CSS Variables (Current - globals.css)

```css
:root {
  --bg-body: #121212;
  --bg-surface: #1E1E1E;
  --bg-glass: rgba(30, 30, 30, 0.95);
  --border-dim: #333333;
  --border-highlight: #CCFF00;
  --text-bright: #FFFFFF;
  --text-main: #C9C9C9;
  --text-muted: #8B8B8B;
  --accent-lime: #CCFF00;
  --accent-lime-dim: rgba(204, 255, 0, 0.15);
  --accent-orange: #FF5F1F;
  --accent-red: #FF3131;
  --grid-line: #1E1E1E;
}
```

## Existing Component Patterns (globals.css)

```css
/* Sketch Button - offset shadow, moves on hover */
.sketch-btn { box-shadow: 5px 5px 0px 0px var(--accent-lime); }

/* Ask AI Button - dashed orange border */
.ask-ai-btn { border: 2px dashed var(--accent-orange); }

/* Experience Card - surface bg, dim border, lime on hover */
.experience-card { background: var(--bg-surface); border: 1px solid var(--border-dim); }

/* Tech Pills - mono font, dim border */
.tech-pill { font-family: 'Roboto Mono', monospace; border: 1px solid var(--border-dim); }

/* Marquee - pauses on hover */
.marquee-container:hover { animation-play-state: paused; }
```

## Fonts (Current)

```css
@import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@300;400;500&family=Roboto+Slab:wght@300;400;500;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
```

| Role | Font | Current Usage |
|------|------|---------------|
| Headings | Space Grotesk | Hero name, section titles |
| Body | Space Grotesk | Descriptions, copy |
| UI/Code | Roboto Mono | Tech pills, nav items, timestamps |

---

## Information Density

### Philosophy: "Sparse surface, dense on engagement"

The first screen is clean, intriguing, spacious. Interaction reveals depth.

| State | Density |
|-------|---------|
| Hero / Landing | Generous whitespace, few elements, intrigue |
| On hover | Reveals more info (tooltips, expanded cards) |
| On click | Info-rich panels, detail views, full content |
| Timeline / Lists | Medium density, scannable |
| Machine mode | Maximum density, developer-focused |

### Rule

Never overwhelm on arrival. Let curiosity pull them deeper.

---

## First Impression Goal

**In 3 seconds, the visitor should feel:**

> "What's happening here? I want to keep looking."

Not impressed. Not sold. **Intrigued.**

The site should make them lean in, not lean back.

---

## Border & Separation

- Use **spacing** as primary separator (no border needed)
- When borders are needed: subtle, 1px, low contrast (`--border`)
- Gradient borders reserved for special moments (primary CTAs, featured cards)
- Let content breathe — if it feels crowded, remove, don't add borders

---

## Summary

| Element | Current (Live) | v2 Direction |
|---------|----------------|--------------|
| Base | Dark `#121212` | Keep or shift to Navy `#0A1628` |
| Primary Accent | Lime `#CCFF00` | Keep ✓ |
| Secondary Accent | Orange `#FF5F1F` | Keep ✓ |
| Headings | Space Grotesk Bold | Keep ✓ |
| Body | Space Grotesk Regular | Keep ✓ |
| UI/Code | Roboto Mono | Keep (or shift to JetBrains Mono) |
| Background | Grid pattern, animated | Keep or simplify |
| Buttons | Sketch style (offset shadow) | Keep ✓ |
| Cards | Surface bg, dim border, lime hover | Evolve to vinyl aesthetic |
| Nav | Top bar, horizontal | Shift to fixed left sidebar |
| Motion | Grid shifts, marquee scrolls | Still until engaged |
| Character | None currently | Add Alan Iverson |
| Toggle | None currently | Add Human/Machine |

### What Stays
- Color palette (lime + orange on dark)
- Typography (Space Grotesk + Roboto Mono)
- Sketch button style
- Tech pills aesthetic

### What Evolves
- Navigation → left sidebar
- Cards → vinyl/album cover style
- Add turntable loading page
- Add banner widgets
- Add Alan Iverson chat character
- Add Human/Machine toggle

---

*This is the foundation. Every component, prompt, and decision references this document.*
