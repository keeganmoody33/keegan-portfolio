# Ask Alan Iverson — Feature Spec

**Status:** Scoping
**Created:** Feb 1, 2026
**Priority:** High (brand-defining feature)

---

## Overview

"Ask Alan Iverson" is a persona wrapper for the portfolio chat. Alan is the opener and the vibe. The actual chat voice is Keegan — professional, grounded, helpful.

**Two-speaker system:**
- **Alan** (cameo) = swoops in, drops the practice line, hands off
- **Keegan** (chat) = fields questions, reflects the real person

---

## Core Interaction Flow

```
[User clicks "Ask Alan Iverson"]
         ↓
[Chat opens]
         ↓
[Alan swoops in — bottom right]
         ↓
[Speech bubble #1]: "We talkin' about practice. Not a game."
         ↓
[Speech bubble #2]: "Alright—Keegan's got you. Ask away."
         ↓
[Bubble disappears]
         ↓
[Alan goes idle — 75-85% opacity, subtle animation]
         ↓
[Chat is now "Keegan voice" — professional Q&A]
         ↓
[User closes chat]
         ↓
[Alan swoosh-exits]
```

---

## Character Definition

**Who is Alan?**
- A persona wrapper, NOT literally Allen Iverson
- No endorsement claim, no NBA/NFL logos
- "Alan" = an arcade-streetball inspired character
- Represents "The Answer" energy: direct, confident, no fluff

**Visual inspiration:**
- NBA Street Vol. 2 / NFL Street "EA BIG" proportions
- Optional: 1960s Spider-Man comic print treatment (Ben-Day dots, bold ink)

---

## Visual Style Tracks

### Track A — Street-inspired 3D
- Chunky proportions (oversized head, big hands/feet)
- Glossy highlights, simple materials
- Clean readable silhouette
- Confident low stance

### Track B — 1960s Comic Print
- Bold ink outlines
- Ben-Day/halftone dot shading
- Limited flat color palette (3-5 colors)
- High contrast, simple highlights

### Track C — Hybrid (optional)
- Street proportions (form) + 60s print surfacing (dots/ink)

**Decision:** Generate all tracks, compare at small UI size, pick winner.

---

## UI Specs

| Property | Value |
|----------|-------|
| Placement | Bottom-right corner |
| Scale | Medium but subtle |
| Opacity (idle) | 75-85% |
| Intro | Once per session only |
| Mobile | Never blocks chat input/send |

---

## Animation States

Three states needed for each style track:

| State | Description | Duration |
|-------|-------------|----------|
| Enter | Swoop in from right | 0.4-0.7s |
| Idle | Subtle blink/bounce loop | Continuous |
| Exit | Swoosh away to right | 0.3-0.6s |

---

## Copy

### Speech Bubble (one-time)

**Line 1 (the joke):**
> "We talkin' about practice. Not a game."

**Line 2 (handoff):**
> "Alright—Keegan's got you. Ask away."

### Chat First Message (Keegan voice)
> "Hey—happy to help. What are you trying to figure out: role fit, projects, or resume bullets?"

---

## Tone Guide

### Alan Voice (bubble only)
- 1-2 lines max
- Slight swagger / wink
- Then gets out of the way
- No forced basketball slang after handoff

### Keegan Voice (chat)
- Professional, clear, helpful
- Still human and authentic
- Grounded in portfolio receipts
- Links evidence where relevant

---

## Technical Implementation

### State Management
```javascript
// Session storage flag
hasShownAlanIntro: boolean

// On chat open:
if (!hasShownAlanIntro) {
  mountAlanOverlay()
  playEnterAnimation()
  showBubbleLine1()
  await delay(1200)
  showBubbleLine2()
  await delay(2000)
  hideBubble()
  setHasShownAlanIntro(true)
}
focusChatInput()

// During chat:
// Alan visible at reduced opacity, idle loop

// On chat close:
playExitAnimation()
unmountAlanOverlay()
```

### Bubble Timing
- Line 1 displays for ~1.2s
- Line 2 displays for ~2s (or until user types)
- Total bubble time: ~3-4s

---

## Asset Checklist

### Per Style Track (A, B, or C)

| Asset | Format | Size |
|-------|--------|------|
| alan_[track]_enter | PNG → Lottie/WebM | 1024x1024 |
| alan_[track]_idle | PNG → Lottie/WebM | 1024x1024 |
| alan_[track]_exit | PNG → Lottie/WebM | 1024x1024 |

**Generation rules:**
- Transparent background
- Centered subject with padding
- No logos, no text
- Character cutout only (no scenes)

### Format Decision Tree
- If Track B wins → Lottie (vector-friendly)
- If Track A wins → Transparent WebM (3D render)

---

## Prompts for Generation

### Track A (Street 3D)
```
"Original stylized 3D streetball mascot with early-2000s arcade sports game proportions (slightly oversized head, big hands/feet), confident low stance, clean readable silhouette, glossy highlights, simple materials, transparent background, no NBA/NFL logos, no team logos, no text. Design for UI overlay: medium size, subtle presence. Create pose: [ENTER/IDLE/EXIT]."
```

### Track B (60s Print)
```
"Original streetball mascot illustrated in 1960s comic print style: bold ink outlines, limited flat color palette, Ben-Day/halftone dot shading in shadows, high contrast, simple highlights, transparent background, no logos, no text. Design for UI overlay: medium size, subtle presence. Create pose: [ENTER/IDLE/EXIT]."
```

### Track C (Hybrid)
```
"Original stylized streetball mascot with early-2000s arcade proportions, rendered in 1960s comic print style (bold ink outlines + Ben-Day dot shading), limited palette, no logos, transparent background. Design for UI overlay: medium size, subtle presence. Create pose: [ENTER/IDLE/EXIT]."
```

---

## Done Criteria

- [ ] "Ask AI" label replaced with "Ask Alan Iverson"
- [ ] Alan enters on chat open (enter animation)
- [ ] Bubble shows 2 lines, once per session
- [ ] After handoff, bubble never reappears until new session
- [ ] Alan stays bottom-right at ~75-85% opacity
- [ ] Alan idles subtly (no constant antics)
- [ ] On close, Alan exits cleanly
- [ ] Mobile: Alan never blocks input/send
- [ ] Chat voice is Keegan (professional, grounded)

---

## Open Questions

1. **Track selection:** Generate all 3 tracks, compare, then pick?
2. **Tidal username:** For music player integration (separate feature)
3. **Discogs username:** For vinyl widget (separate feature)
4. **GitHub username:** Confirm `keeganmoody33`

---

## Dependencies

- Character assets (enter/idle/exit for chosen track)
- Animation format decision (Lottie vs WebM)
- Session storage implementation
- Chat component refactor to support overlay

---

## Related Features

| Feature | Relation |
|---------|----------|
| Banner widgets | Alan vibe extends to mini now-playing widget |
| Projects tile view | Album cover aesthetic shared |
| Discogs collection | Same flip/hover behavior |

---

*Spec v1.0 — Feb 1, 2026*
