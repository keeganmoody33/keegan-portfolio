# Banner Widgets Spec

**Status:** Planning
**Created:** Feb 1, 2026
**Goal:** Replace static marquee text with live, dynamic widgets

---

## Overview

Current state: Static fake data in a scrolling marquee
Target state: Real-time widgets pulling from APIs + persistent music player

---

## Widgets

### 1. Music Player (Tidal)

**What it does:**
- Embeds a Tidal track/playlist
- Persists outside the marquee scroll (keeps playing when scrolled)
- Shows: Album art, track name, artist, play/pause

**Technical approach:**
- Option A: Tidal embed iframe (simplest, limited customization)
- Option B: Tidal API + custom player UI (more control, needs auth)

**Open questions:**
- [ ] What track/playlist to feature? Or pull "now playing"?
- [ ] Tidal API access — do you have developer credentials?

**Fallback:** Static curated track with manual updates

---

### 2. GitHub Activity Graph

**What it does:**
- Mini bar graph showing recent commit activity
- Shows last 7-14 days of contributions
- Clicking opens GitHub profile

**Technical approach:**
- Fetch from: `api.github.com/users/{username}/events`
- Or scrape contribution calendar data
- Render as mini SVG bars in marquee

**Data needed:**
- [ ] GitHub username: `keeganmoody33` (confirm)

**Scope:**
- MVP: Static fetch on page load
- V2: Real-time updates via polling or webhooks

---

### 3. Discogs Recent Adds

**What it does:**
- Shows recently added vinyl to collection
- Album art thumbnails that scroll through
- Clicking opens Discogs listing

**Technical approach:**
- Discogs API: `api.discogs.com/users/{username}/collection`
- Requires: Username + Personal Access Token
- Rate limit: 60 requests/min (generous)

**Data needed:**
- [ ] Discogs username
- [ ] Personal Access Token (from Discogs settings)

**Scope:**
- MVP: Last 5 records added
- V2: Carousel with album art hover states

---

### 4. Status Badge

**What it does:**
- Shows current availability/status
- "Open to founding GTM roles" or "Building: [project]"
- Could link to calendar or contact

**Technical approach:**
- Simple state from database or config file
- Admin toggle to update status

**Scope:**
- MVP: Static text from config
- V2: Editable via admin panel

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  PERSISTENT MUSIC PLAYER (fixed position, always visible)   │
│  [▶] Track Name - Artist                    [Tidal logo]   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SCROLLING MARQUEE                                          │
│  [GitHub ▃▅▂▇▄ 14 commits] [🎵 New: Blue Note] [Status]    │
└─────────────────────────────────────────────────────────────┘
```

---

## Linear Issues Breakdown

| Issue | Priority | Estimate |
|-------|----------|----------|
| Create GitHub activity widget component | P1 | 2h |
| Integrate GitHub API fetch | P1 | 1h |
| Create Discogs widget component | P2 | 2h |
| Integrate Discogs API fetch | P2 | 1h |
| Build persistent Tidal player | P2 | 3h |
| Refactor Marquee to accept widget components | P1 | 1h |
| Add status badge widget | P3 | 30m |
| Environment variables for API keys | P1 | 30m |

**Total estimate:** ~11 hours

---

## Open Questions

1. **Tidal:** Track/playlist URL? Or "now playing" integration?
2. **Discogs:** Username + do you have API token?
3. **GitHub:** Confirm `keeganmoody33`
4. **Priority:** Which widget first?

---

## Next Steps

1. Answer open questions above
2. Create Linear issues from breakdown
3. Start with GitHub widget (no auth needed, quick win)
