# Banner Widgets Spec

**Status:** LOCKED
**Created:** Feb 1, 2026
**Updated:** Feb 2, 2026
**Goal:** Dynamic widgets with live data + persistent music player

---

## Final Decisions (Locked Feb 2, 2026)

| Decision | Answer |
|----------|--------|
| **Layout** | TBD in Aura — not specifying config now |
| **Position** | Top of page |
| **Behavior** | Cursor hover stops marquee scroll |
| **Music source** | YouTube (NOT Tidal) — persists from turntable |

---

## Widgets (3 Total)

### 1. YouTube Player

**What it does:**

- Persistent music player that continues from turntable intro
- Can browse playlist and switch tracks
- Hover reveals controls
- Play/pause, track info, progress

**Technical approach:**

- YouTube IFrame API (same as turntable)
- State passed via sessionStorage from turntable
- Controls: play/pause, next/prev, volume

**Playlist:** `PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk`

---

### 2. GitHub Activity (Classic Retro Bars)

**What it does:**

- Retro vertical bar graph showing recent commit activity
- Classic arcade/pixel aesthetic
- Last 7-14 days of contributions
- Clicking opens GitHub profile

**Technical approach:**

- Fetch from: `api.github.com/users/keeganmoody33/events`
- Render as retro vertical bars (think classic arcade)
- Subtle animation/glow optional

**Username:** `keeganmoody33` ✅

**Visual reference:**

- Classic retro vertical bars
- Pixel/arcade aesthetic
- Could add subtle glow or pulse

---

### 3. Recent Digs (Discogs)

**What it does:**

- Shows recently added vinyl to collection
- Title + metadata displayed
- Taps into Discogs API

**Technical approach:**

- Discogs API: `api.discogs.com/users/lecturesfrom/collection`
- Show recent additions with:
  - Album title
  - Artist
  - Year (optional)
  - Cover art thumbnail

**Username:** `lecturesfrom` ✅

**Scope:**

- MVP: Last 3-5 records added
- Display: Title, artist, thumbnail

---

## Confirmed Accounts

| Service | Username |
|---------|----------|
| GitHub | keeganmoody33 |
| Discogs | lecturesfrom |
| YouTube | Playlist `PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk` |

---

## Architecture (Conceptual)

```
┌─────────────────────────────────────────────────────────────┐
│  BANNER (top of page, hover stops scroll)                   │
│                                                             │
│  [▶ YouTube Player]  [GitHub ▃▅▂▇▄]  [Digs]                  │
│                                                             │
│  Layout TBD in Aura                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Dependencies

- YouTube IFrame API
- GitHub REST API (no auth needed for public events)
- Discogs API + token (env var)

---

## Resolved Questions

1. ~~**Music source:**~~ ✅ YouTube (not Tidal)
2. ~~**GitHub username:**~~ ✅ keeganmoody33
3. ~~**Discogs username:**~~ ✅ lecturesfrom
4. ~~**GitHub visualization:**~~ ✅ Classic retro vertical bars
5. ~~**Layout:**~~ ✅ TBD in Aura

## Remaining TBD

1. **Exact layout/spacing:** Will be designed in Aura

---

*Spec v2.0 — Feb 2, 2026*
