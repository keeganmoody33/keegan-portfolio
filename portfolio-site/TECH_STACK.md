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
| @vercel/blob | 2.8.1 | Public object store for Cover Art Archive fronts (`BLOB_READ_WRITE_TOKEN`). No-op when the token is unset. |
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
| MusicBrainz | <https://musicbrainz.org/ws/2> | User-Agent with contact; ~1 req/s | (none — manual crate enrich only) |
| Cover Art Archive | <https://coverartarchive.org> | User-Agent `lecturesfrom/1.0 (33@lecturesfrom.com)`; ~1 req/s | (none — `npm run covers:sync` only) |
| Vercel Blob | `@vercel/blob` put | Header token | BLOB_READ_WRITE_TOKEN (Next.js env; optional) |
| Wikidata SPARQL | <https://query.wikidata.org/sparql> | User-Agent with contact; ~1 req/s; 5s timeout; honors Retry-After; CC0 | (none — fallback after Discogs extraartists; P1954 / P436 / P2206 / P5813) |
| GitHub | <https://api.github.com/users/keeganmoody33/events/public> | None (unauthenticated, 60 req/hr) | (none — `/api/github` does not read a token) |
| Upstash Redis | REST (`KV_REST_API_URL` / `UPSTASH_REDIS_REST_URL`) | Bearer token | KV_REST_API_URL, KV_REST_API_TOKEN (preferred); UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (fallback) |
| Supabase | NEXT_PUBLIC_SUPABASE_URL/functions/v1/* | Header: `Authorization: Bearer <anon_key>` | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY |

**Discogs:** `api.discogs.com`; optional `DISCOGS_TOKEN` (public `lecturesfrom` collection). Full crate (`fetchFullCollection()`) at `/api/discogs/collection` and house `/collection` serves a durable last-good copy from Upstash Redis when configured. **A visit never writes Redis** — visitors read last-good or crawl in-memory. Listing refresh is gated (`/api/cron/collection-keep`). Skip Redis during `next build` so `/collection` stays ISR (`revalidate = 300`). Crate writes stay `cache: 'no-store'`. Detail pressing GETs use `next: { revalidate: 60 }`. User-Agent: `lecturesfrom/1.0 +https://lecturesfrom.com`. Missing Redis env = in-memory last-good + Discogs crawl. Errors use `Cache-Control: no-store`. Do not call `Redis.fromEnv()`. Not used on `/keeganmoody33`. **Do not store Discogs images** in Blob or Redis: API Terms forbid caching Content longer than necessary and transferring Restricted Data to third parties. Collection covers hotlink `images[0].uri` / primary (grid prefers `thumbnail` then `cover` unless a CAA Blob URL is stored). **Prototype gap:** Discogs API Terms freshness (~6h) is not implemented; gated keep uses `DISCOGS_SNAPSHOT_TTL_MS` (24h); ISR `revalidate = 300`. See [API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use). Per-track extraartists from the already-fetched release are fallback credits after MusicBrainz.

**Cover Art Archive / Vercel Blob:** Manual `npm run covers:sync` (preview Redis `lf:preview:crate:cover:{id}:v1` unless `--prod`). Source order: CAA front by MusicBrainz release mbid, then release group, then largest Discogs image (hotlink only). Prefer ≥1200px. CAA bytes may be stored once at `covers/{sha256}.{ext}` when `BLOB_READ_WRITE_TOKEN` is set; missing token no-ops upload and the renderer falls back to the Discogs URL. CAA images remain copyrighted; no extra on-page notice beyond existing Discogs credits. User-Agent `lecturesfrom/1.0 (33@lecturesfrom.com)`, 1.1s between CAA/MB requests.

**MusicBrainz:** manual crate enrich only (`lib/crate/musicbrainz.ts`). User-Agent `lecturesfrom/1.0 ( 33@lecturesfrom.com )`, minimum 1.1s between requests. Visitor record-detail reads Redis or committed fixtures — never live MusicBrainz, Discogs release detail, or Wikidata. No WhoSampled. No scraping. Research runs via CRON_SECRET-gated `/api/cron/crate-backfill` (`?ids=&retry=1`) and `npm run crate:backfill`. No Vercel cron. `CRON_SECRET` is not in production and must not be added without Keegan's yes.

**Wikidata:** SPARQL fallback after Discogs extraartists. User-Agent `lecturesfrom/1.0 +https://lecturesfrom.com ( 33@lecturesfrom.com )`, one module-level client (`lookupWikidataReleaseFacts` / `wikidataFactsFor` must not `createWikidataClient` per call), 1.1s interval, 5s timeout, honors `Retry-After`. Identity: Discogs master `P1954`, then MusicBrainz release group `P436`, then Discogs release `P2206` / catalog `P5813`. More than one item at the winning key is ambiguous and is not merged. Credits: P175/P86/P676/P162/P87. Samples: `P5707` inbound and outbound (not P736/P144/P4969). `sourceUrl` is the claim-bearing item. 429/5xx/timeout keep prior Wikidata facts. CC0.

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
