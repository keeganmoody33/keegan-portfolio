# Tech Stack — Portfolio Site

**Do not add dependencies not listed here without explicit approval.**

---

## Production Dependencies

All versions are pinned from `portfolio-site/package-lock.json`.

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.3.6 | Framework: App Router, API routes, server/client components |
| react | 19.2.4 | UI library |
| react-dom | 19.2.4 | React DOM renderer |
| @supabase/supabase-js | 2.90.1 | Supabase client; queries candidate_profile, experiences, etc. |
| @upstash/redis | 1.35.6 | REST Redis client for the durable Discogs last-good snapshot |
| posthog-js | 1.436.0 | Client-side analytics (components, page events) |
| posthog-node | 5.21.2 | Server-side analytics (API routes via lib/posthog-server.ts) |
| @jam.dev/sdk | 1.0.1 | Jam session recording metadata client |

---

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| eslint | 9.x | Lint runner (`eslint .`). `next lint` is invalid on Next 16 (treats `lint` as a directory). |
| eslint-config-next | 16.1.6 | Next.js ESLint rules. `eslint .` passes on Next 16.3.6. |
| @types/node | 20.19.30 | Node.js type definitions |
| @types/react | 19.2.10 | React type definitions |
| @types/react-dom | 19.2.3 | React DOM type definitions |
| tailwindcss | 3.4.19 | Utility CSS, design tokens |
| postcss | 8.5.23 | CSS processing pipeline |
| autoprefixer | 10.4.23 | Vendor prefixes for CSS |

**Brand assets:** `npm run generate:brand` (`scripts/generate-brand-assets.mjs`) rebuilds `icon.svg`, `favicon.ico`, `apple-icon.png`, and house OG/twitter PNGs from `brand/lecturesfrom-mark.svg`. Needs system `rsvg-convert` and `python3-pil`. Not an npm dependency.

---

## Supabase Edge Functions (Deno)

Runtime: **Deno**. Imports use URL specifiers with pinned versions where available.

| Import URL | Pinned Version | Purpose |
|------------|----------------|---------|
| `Deno.serve()` | Built-in (Deno runtime) | HTTP server — replaced deprecated `std@0.168.0/http/server.ts` import on 2026-07-24 |
| <https://esm.sh/@supabase/supabase-js@2.90.1> | 2.90.1 | Supabase client in Edge Functions (patch-pinned for reproducibility) |

---

## External APIs

| Service | Endpoint | Auth Method | Env Variable |
|---------|----------|-------------|--------------|
| Anthropic Claude | <https://api.anthropic.com/v1/messages> | Header: `x-api-key` | ANTHROPIC_API_KEY (Supabase secrets) |
| Firecrawl | <https://api.firecrawl.dev/v1/scrape> | Header: `Authorization: Bearer <token>` | FIRECRAWL_API_KEY (Supabase secrets) |
| PostHog | <https://us.i.posthog.com> | Project key in client init | NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST |
| Discogs | <https://api.discogs.com> | Header: `Authorization: Discogs token=<token>`, User-Agent required | DISCOGS_TOKEN (Next.js env) |
| MusicBrainz | <https://musicbrainz.org/ws/2> | User-Agent with contact; ~1 req/s | (none — background enrich only) |
| GitHub | <https://api.github.com/users/keeganmoody33/events/public> | None (unauthenticated, 60 req/hr) | (none — `/api/github` does not read a token) |
| Upstash Redis | REST (`KV_REST_API_URL` / `UPSTASH_REDIS_REST_URL`) | Bearer token | KV_REST_API_URL, KV_REST_API_TOKEN (preferred); UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (fallback) |
| Supabase | NEXT_PUBLIC_SUPABASE_URL/functions/v1/* | Header: `Authorization: Bearer <anon_key>` | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY |

**Discogs:** `api.discogs.com`; optional `DISCOGS_TOKEN` (public `lecturesfrom` collection). Full crate (`fetchFullCollection()`) at `/api/discogs/collection` and house `/collection` serves a durable last-good copy from Upstash Redis when configured; Discogs collection snapshot and pressing facts/tracklist refresh within 6h when a visit finds them stale (`after()` + `SET NX EX` lock). Hobby cron remains daily (`37 4 * * *`) — without traffic, Discogs data can sit until that run. Redis reads are `cache: 'no-store'` (empty MGETs must not enter Next's Data Cache) and are skipped during `next build`, so `/collection` stays ISR (`revalidate = 300`). User-Agent: `lecturesfrom/1.0 +https://lecturesfrom.com`. Missing Redis env = today's in-memory last-good + Discogs crawl. Errors use `Cache-Control: no-store`. Do not call `Redis.fromEnv()` (it only warns, then fails later). Not used on `/keeganmoody33` (career `/api/discogs` / RecentDigs removed).

**MusicBrainz:** background crate enrich only (`lib/crate/musicbrainz.ts`). User-Agent `lecturesfrom/1.0 ( 33@lecturesfrom.com )`, minimum 1.1s between requests, one client per drain, 429/503 honour Retry-After and stop the batch. Visitor record-detail reads Redis (`lf:crate:pressing:{id}:v1`) or committed fixtures — never live MusicBrainz or Discogs release detail. Match via unique Discogs URL (then stop), else barcode/catno (score ≥95 plus similar title or track count), then artist + title + year/label. Lucene-escaped queries; Discogs ` (2)` artist suffix stripped. Failed refresh must not overwrite a successful pressing (`CRATE_ENRICH_FAIL_IDS` / `failRefresh` hook); a weaker MusicBrainz refresh keeps the prior match plus `lastError`. Descriptions are Discogs notes only (no MusicBrainz annotations). Queue: Redis zset + dedupe set, remove after success, new ids to the front. Drain: `after()` awaits 1 item on collection sync; a fresh `/collection` visit may process 1 more behind `SET NX EX 300`; daily GET `/api/cron/crate-enrich` (Bearer `CRON_SECRET`, `timingSafeEqual`) drains until a ~45s budget. No WhoSampled. No scraping.

---

## Supabase

- **Project:** PostgreSQL + Edge Functions
- **Edge Functions runtime:** Deno
- **Tables used by app:** candidate_profile, experiences, skills, gaps_weaknesses*, values_culture, faq_responses, ai_instructions
- *`gaps_weaknesses` is fetched by Edge Functions but **not included in public chat context** (removed Jan 2026). See BACKEND_STRUCTURE.md for details.
- **Edge Functions:** `chat`, `jd-analyzer` (deployed via `supabase functions deploy`)

---

## Deployment

- **Platform:** Vercel
- **Live URL:** lecturesfrom.com (house) and lecturesfrom.com/keeganmoody33 (principal)
- **Build:** Next.js (`next build`); auto-deploy on push to main

**Brand asset toolchain (not runtime):** `scripts/generate-wordmark.py` uses Python 3 + fontTools + rsvg-convert (Pillow for proofs). These are not Next.js dependencies. Do not add them to `package.json`.

---

## Related Docs

- [PRD.md](PRD.md) -- Product definition, features, scope
- [APP_FLOW.md](APP_FLOW.md) -- Route inventory and interaction flows
- [FRONTEND_GUIDELINES.md](FRONTEND_GUIDELINES.md) -- Design system, tokens, component patterns
- [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) -- Database schema, API contracts, Edge Functions
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) -- Phased build sequence
- [progress.txt](progress.txt) -- Current completion state
- [lessons.md](lessons.md) -- Mistakes and patterns to avoid
