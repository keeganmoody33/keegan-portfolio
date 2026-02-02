# Aura.build Prompts — Portfolio Features

**Created:** Feb 2, 2026
**Purpose:** Copy-paste ready prompts for designing each feature in Aura.build

---

## 1. Turntable Loading Page

### Prompt
```
Design a turntable loading page for a portfolio website.

PERSPECTIVE: 45-degree angle POV — like looking down at a turntable sitting on a desk in front of you. Not bird's eye view.

STYLE: Sketch aesthetic — hand-drawn, illustrated feel. Clean, minimal, high contrast. Black and white primary palette.

ELEMENTS:
- Vinyl record on platter (spinning)
- Tonearm or play button (interactive element to start music)
- Dark/black background
- Subtle "skip" button in corner (small, unobtrusive text)

INTERACTION: User clicks to "drop the needle" which starts music and proceeds to portfolio. This is a forcing function — can't enter site without engaging.

SKIP BUTTON: Small, subtle. Does NOT say "skip" — says something clever that makes the user feel slightly "lame" for skipping (e.g., "I don't like music", "silence please").

Export as HTML/Tailwind.
```

---

## 2. Banner / Header

### Prompt
```
Design a banner/header for a portfolio website with 4 widget sections.

POSITION: Top of page, sticky
BEHAVIOR: Marquee-style scroll that stops on cursor hover

WIDGETS (left to right or however looks best):
1. YouTube Music Player — play/pause, track info, ability to browse playlist
2. GitHub Activity — classic retro vertical bar graph showing recent commits (arcade/pixel aesthetic)
3. Recent Digs — Discogs integration, shows recently added vinyl (thumbnail, title, artist)
4. Worthy Reads — curated reading list, links to articles/Substack posts

AESTHETIC:
- Dark mode
- GitHub bars should feel retro/arcade (think classic 8-bit bar charts)
- Music player should be compact but functional
- Clean, minimal, high information density

Export as HTML/Tailwind with responsive breakpoints.
```

---

## 3. Navigation Header

### Prompt
```
Design a navigation header for a portfolio website.

NAV ITEMS (7 total):
1. Personal Projects — opens vinyl grid overlay
2. Physical Products — placeholder page (greyed out or "coming soon" treatment)
3. My Stack of Wax — opens vinyl grid overlay (Discogs collection)
4. Who I Am — routes to page
5. About LecturesFrom — routes to page
6. Contact — routes to page
7. Work With Me — routes to page

BEHAVIOR:
- Items 1 and 3 open a full-screen overlay with vinyl tiles
- Items 2, 4-7 route directly to pages
- Item 2 should indicate it's a placeholder (coming soon)

STYLE:
- Dark mode
- Clean, minimal
- Clear visual distinction between "collection" items (1, 3) and "page" items

Export as HTML/Tailwind.
```

---

## 4. Vinyl Grid Overlay

### Prompt
```
Design a full-screen overlay for displaying project tiles in a vinyl/album cover aesthetic.

CONTEXT: Opens when user clicks "Personal Projects" or "My Stack of Wax" in the nav.

TILE DESIGN (album cover aesthetic):
- Square tiles (1:1 ratio like album covers)
- Hero image fills tile
- On hover: reveal overlay with title, short description, tech stack chips
- Subtle rotation/tilt on hover (10-15 degrees, like pulling a record from a stack)

GRID LAYOUT:
- Responsive grid (4 columns desktop, 2 tablet, 1 mobile)
- Comfortable spacing between tiles

OVERLAY CONTAINER:
- Full screen, dark semi-transparent background
- Close button (X) in corner
- Title at top (e.g., "Personal Projects")

BEHAVIOR:
- Clicking a tile routes to project detail page (for built-out projects)
- Or shows expanded view in overlay (for simpler projects)

Export as HTML/Tailwind with hover states.
```

---

## 5. Vinyl Tile Component

### Prompt
```
Design a single project tile in vinyl/album cover style.

SIZE: Square (1:1 ratio)

FRONT (default state):
- Full-bleed hero image (project screenshot or custom art)
- Project title overlaid at bottom
- Subtle gradient overlay for text readability

HOVER STATE:
- Slight tilt/rotation (10-15 degrees)
- Overlay slides up revealing:
  - Short goal/purpose (1-2 lines)
  - Tech stack chips (3-5 items)
  - 1-2 key learnings (optional)
- Scale up slightly (1.02-1.05)

STYLE:
- Album cover aesthetic
- High contrast
- Clean typography
- Feels like pulling a record from a stack

Export as HTML/Tailwind component with hover animations.
```

---

## 6. Project Detail Page

### Prompt
```
Design a project detail page for a portfolio website.

SECTIONS (in order):
1. Hero Block — title, tagline, category badge, hero image (album-style)
2. "Why I Built It" — narrative section, personal motivation
3. Technical Breakdown — stack chips, architecture notes, implementation details
4. Outcome/Impact — what happened, did it ship, learnings
5. Links — source repo, live demo, related docs

STYLE:
- Long-form reading layout
- Dark mode
- Clear section headers
- Code blocks for technical content
- Stack chips as pills/badges

TONE: Honest, not polished. This is LecturesFrom — real talk about what worked and didn't.

Export as HTML/Tailwind.
```

---

## 7. Alan Iverson Chat Interface

### Prompt
```
Design a chat interface with a character mascot.

CHARACTER: "Alan" — arcade/streetball inspired character
- Positioned bottom-right of chat window
- 75-85% opacity when idle
- Subtle idle animation (blink or slight bounce)

CHAT FLOW:
1. User opens chat
2. Alan swoops in from right
3. Speech bubble appears: "We talkin' about practice. Not a game."
4. Second bubble: "Alright—Keegan's got you. Ask away."
5. Bubbles fade, Alan stays visible but quiet
6. Chat continues in standard format

CHAT INTERFACE:
- Dark mode
- Message bubbles (user right, AI left)
- Input field at bottom
- Clean, minimal

CHARACTER STYLE OPTIONS (design both):
A) Street 3D — chunky proportions, glossy, arcade-game feel
B) 60s Comic — bold ink outlines, Ben-Day dots, limited color palette

Export as HTML/Tailwind with animation keyframes.
```

---

## 8. Human/Machine Toggle

### Prompt
```
Design a Human/Machine mode toggle for a portfolio website.

TOGGLE DESIGN:
- Horizontal pill shape
- Two options: "HUMAN" and "MACHINE"
- Radio-button style indicators (● for active, ○ for inactive)
- Position: Sticky/floating at bottom center of viewport

BEHAVIOR:
- Instant swap (no transition animation)
- Scroll position preserved when toggling

HUMAN MODE:
- Traditional visual web design
- Marketing copy, gradients, visual hierarchy
- Styled buttons, card grids

MACHINE MODE:
- Dark terminal aesthetic (black background, monospace font)
- Content rendered as markdown
- Links show URLs: `[Link Text](https://url)`
- Headers use `#` and `##` syntax
- Tables use pipe separators
- High information density

Reference: parallel.ai has this exact feature.

Export as HTML/Tailwind with both mode states.
```

---

## 9. Turntable "Config Loading" (Machine Mode)

### Prompt
```
Design a "machine mode" version of the turntable loading page.

CONTEXT: When user lands with ?view=machine, they see this instead of the visual turntable.

CONTENT:
- Runtime config panel
- Shows: selected mode = machine
- Schema version info
- Sample API request/response
- Minimal, dense, information-focused

STYLE:
- Dark terminal aesthetic
- Monospace font
- JSON/code blocks
- No animations or decorative elements
- Fast, functional, developer-oriented

This should feel like viewing a config file or API docs, not a marketing page.

Export as HTML/Tailwind.
```

---

## Usage Notes

1. **Export format:** Request HTML/Tailwind for easy integration with Next.js
2. **Breakpoints:** Ask Aura to include responsive breakpoints
3. **Animations:** Request CSS keyframes for hover/transition states
4. **Components:** Design as reusable components where possible
5. **Iterate:** Use Aura's refinement features to dial in spacing, colors, typography

---

*Prompts v1.0 — Feb 2, 2026*
