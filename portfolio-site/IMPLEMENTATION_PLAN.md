# Discogs Recent Digs Widget — Implementation Plan

Reference DESIGN_PLAYBOOK.md for all styling decisions. Reference BANNER_WIDGETS_SPEC.md Section 3 for widget spec. Do not deviate from these docs.

---

## Step 1: Environment Setup

1.1 — Add DISCOGS_TOKEN to portfolio-site/.env.local (if renaming from DISCOGS_API_TOKEN, update the key name to DISCOGS_TOKEN).

1.2 — Add DISCOGS_TOKEN to .env.local.example with placeholder value (e.g. DISCOGS_TOKEN=your_discogs_personal_token).

1.3 — Add DISCOGS_TOKEN to Vercel environment variables (manual step: set in Vercel dashboard for the project).

1.4 — Verify token works:
```bash
curl "https://api.discogs.com/users/lecturesfrom/collection/folders/0/releases?sort=added&sort_order=desc&per_page=5&page=1" \
  -H "Authorization: Discogs token=YOUR_TOKEN" \
  -H "User-Agent: LecturesFromPortfolio/1.0"
```

---

## Step 2: API Route (proxy layer)

2.1 — Create portfolio-site/app/api/discogs/route.ts

2.2 — GET handler that proxies to Discogs collection endpoint (users/lecturesfrom/collection/folders/0/releases, sort=added, sort_order=desc, per_page=5, page=1).

2.3 — Server-side: read DISCOGS_TOKEN from env, add Authorization header (`Discogs token=<token>`) and User-Agent (e.g. LecturesFromPortfolio/1.0).

2.4 — Return: array of { title, artist, year, thumbnail, discogsUrl } transformed from Discogs response.

2.5 — Error handling: missing token returns 500; Discogs API error returns 502.

2.6 — Add PostHog server-side tracking (event api_discogs_request) matching existing patterns in app/api/chat/route.ts: use getPostHogClient() from @/lib/posthog-server, capture with distinctId from header or fallback.

2.7 — Follow exact same proxy pattern as app/api/chat/route.ts (env check → external call → PostHog on request/error → return JSON).

---

## Step 3: Component

3.1 — Create portfolio-site/components/RecentDigs.tsx

3.2 — 'use client' component

3.3 — On mount, fetch GET /api/discogs

3.4 — Display last 5 records: cover art thumbnail (img), artist name, album title

3.5 — Each record links to its Discogs page (target="_blank", rel="noopener noreferrer")

3.6 — Loading state while fetching

3.7 — Error state if fetch fails (graceful — hide widget or show fallback, don't break page)

3.8 — Style per DESIGN_PLAYBOOK.md: bg var(--bg-surface), border var(--border-dim), Roboto Mono for metadata, var(--accent-lime) hover

3.9 — Desktop: horizontal row of 5 records

3.10 — Mobile: horizontal scroll with snap points

3.11 — Add PostHog tracking for record clicks (e.g. recent_digs_record_clicked with title/artist/discogsUrl), matching existing patterns in Timeline.tsx / Chat.tsx

---

## Step 4: Integration

4.1 — Import RecentDigs into portfolio-site/app/page.tsx

4.2 — Place below Marquee component, above the hero section (or in new banner section)

4.3 — Wrap in error boundary so a Discogs API failure never crashes the page

4.4 — Test on desktop and mobile

---

## Step 5: Ship

5.1 — Git commit: "feat: add Discogs Recent Digs widget"

5.2 — Update progress.txt: move Discogs from IN PROGRESS to COMPLETED

5.3 — Push to GitHub, Vercel auto-deploys

5.4 — Verify DISCOGS_TOKEN is set in Vercel dashboard

5.5 — Test live at lecturesfrom.com/keeganmoody33

5.6 — Update TECH_STACK.md if any new packages were needed
