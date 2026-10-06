# Backend Structure — lecturesfrom.com Portfolio

**Last Updated:** 2026-10-06
**Database:** Supabase (PostgreSQL)
**Edge Functions Runtime:** Deno
**API Layer:** Next.js Route Handlers (proxy pattern)

---

## Data Model Overview

Single-candidate portfolio. All tables serve one candidate (`keegan-moody-001`). No multi-tenancy. No user accounts for visitors.

```
candidate_profile (1 row)
    ├── experiences (many, ordered by display_order)
    ├── skills (many, categorized)
    ├── ai_instructions (many, grouped by instruction_type)
    ├── gaps_weaknesses (many)
    ├── values_culture (1 row)
    └── faq_responses (many)
```

---

## Tables

### candidate_profile

Single row. The candidate's core identity.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | PK | `"keegan-moody-001"` |
| `first_name` | text | NOT NULL | `"Keegan"` |
| `last_name` | text | NOT NULL | `"Moody"` |
| `email` | text | | |
| `location` | text | | `"Atlanta, GA"` |
| `headline` | text | NOT NULL | **NOT `title`** -- use `headline` |
| `summary` | text | | **NOT `elevator_pitch`, `career_narrative`, or `looking_for`** |
| `linkedin_url` | text | | |
| `github_url` | text | | |
| `portfolio_url` | text | | |

**Common mistakes:**
- `profile.name` does not exist. Use `${profile.first_name} ${profile.last_name}`
- `profile.title` does not exist. Use `profile.headline`

---

### experiences

Career history. Ordered by `display_order` for timeline rendering.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | PK | Stable experience identifier, e.g. `"exp-kivira"` |
| `candidate_id` | text | FK → candidate_profile.id | |
| `company_name` | text | NOT NULL | |
| `company_url` | text | | |
| `role_title` | text | NOT NULL | **NOT `title`** -- use `role_title` |
| `start_date` | date | | |
| `end_date` | date | nullable | NULL = current role |
| `duration_months` | int | | |
| `location` | text | | |
| `employment_type` | text | | |
| `public_bullets` | text[] | ARRAY | **NOT `bullet_points`** -- use `public_bullets` |
| `private_context_why_joined` | text | | Private. Not exposed to chat. |
| `private_context_why_left` | text | | Private. Not exposed to chat. |
| `private_context_what_i_did` | text | | Private. Not exposed to chat. |
| `private_context_proudest_achievement` | text | | Private. Not exposed to chat. |
| `private_context_what_id_do_differently` | text | | Private. Not exposed to chat. |
| `private_context_manager_would_say` | text | | Private. Not exposed to chat. |
| `display_order` | int | | Lower = higher on timeline |

**Common mistakes:**
- `experiences.id` is text, not an auto-generated integer.
- `exp.bullet_points` does not exist. Use `exp.public_bullets`
- `exp.title` does not exist. Use `exp.role_title`
- `experiences.metrics`, `description`, `company_stage`, `company_funding`, and `company_industry` do not exist.
- `experiences.exit_reason`, `verification_status`, `verification_sources`, and `is_featured` do not exist.
- Table is `experiences` (plural), not `experience`

---

### ai_instructions

Multi-row instruction set that controls AI chat behavior. Grouped by `instruction_type`, ordered by `priority`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | int/uuid | PK | |
| `candidate_id` | text | FK → candidate_profile.id | |
| `created_at` | timestamptz | | |
| `instruction_type` | text | NOT NULL | Groups: see below |
| `instruction` | text | | Short label |
| `priority` | int | | Lower = higher priority |
| `content` | text | | Full instruction body |

**instruction_type values:**

| Type | Purpose |
|------|---------|
| `honesty` | Rules about being direct |
| `tone` | Voice guidelines |
| `brevity` | Response length rules |
| `boundaries` | What not to share (salary, etc.) |
| `banned_phrase` | Things the AI must never say |
| `rejection_phrase` | How to decline gracefully |
| `critical_distinction` | Facts that must be stated correctly |
| `response_strategy` | How to approach specific question types |
| `technical_framing` | How to position technical skills |
| `voice_example` | Example phrases in Keegan's voice |
| `proactive_questioning` | When to ask questions back |
| `conversion_logic` | How to drive next steps |
| `information_gating` | What to share when |
| `anti_pattern` | Behaviors to avoid |

---

### skills

Categorized skill inventory with evidence.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | int | PK, auto | |
| `candidate_id` | text | FK → candidate_profile.id | |
| `category` | text | | Chat bucket: `"strong"`, `"moderate"`, `"developing"`, or `"gap"` |
| `skill_name` | text | | |
| `proficiency_level` | text | | Descriptive label; live rows mirror the bucket as `STRONG`/`MODERATE`/`GAP` |
| `evidence` | text | | Concrete proof of the skill |

**Common mistakes:**
- `skills` has `candidate_id` and `proficiency_level`; do not omit them from inserts.
- `skills.years_experience`, `notes`, and `created_at` do not exist.

---

### gaps_weaknesses

Explicit limitations. Fetched by Edge Functions but **not included in public-facing chat context** (removed in Jan 2026 fix).

| Column | Type | Notes |
|--------|------|-------|
| `id` | int | PK, auto |
| `candidate_id` | text | FK |
| `type` | text | Gap classification |
| `item` | text | The gap |
| `context` | text | Private framing |

**Common mistakes:**
- Use `gaps_weaknesses.type`, `item`, and `context`; `area` does not exist.
- `gap_name`, `gap_type`, `description`, `growth_path`, and `is_active` do not exist.

---

### values_culture

Single row. Work style and environment preferences.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int/uuid | PK |
| `candidate_id` | text | FK |
| (various) | text | Must-haves, dealbreakers, work style |

---

### faq_responses

Pre-written answers to common questions the AI can reference.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int/uuid | PK |
| `candidate_id` | text | FK |
| `question` | text | The question pattern |
| `response` | text | Pre-written answer |

---

### achievements

Populated but **not currently queried** by any Edge Function. Known issue tracked in progress.txt.

---

## Auth Model

- **Visitors:** No authentication. All content is public.
- **API routes:** Protected by Supabase anon key (passed as Bearer token). No RLS policies enforcing row-level access.
- **Edge Functions:** Called via Supabase URL + anon key. Claude API key stored as Supabase secret.
- **Discogs route:** Server-side only token (`DISCOGS_TOKEN`). Never exposed to client.

---

## API Endpoint Contracts

All API routes live in `portfolio-site/app/api/` and follow the **proxy pattern**: browser -> Next.js Route Handler (keeps secrets server-side) -> external service.

### POST /api/chat

Proxies to Supabase `chat` Edge Function.

**Request:**
```json
{
  "question": "string (required)"
}
```

**Headers:** `X-POSTHOG-DISTINCT-ID` (optional, for tracking)

**Response (200):**
```json
{
  "response": "string (AI answer)"
}
```

**Errors:**
- `400` -- `{ "error": "Question is required" }`
- `500` -- `{ "error": "Supabase configuration missing" }` or `{ "error": "Failed to get response from AI" }`

**PostHog events:** `api_chat_request`, `api_chat_error`

---

### GET /api/discogs/collection

Full paginated Discogs crate for `/collection`. Paginates `per_page=100` until `pagination.pages` is exhausted.

**Request:** No params.

**Response (200):**
```json
{
  "releases": [
    {
      "title": "string",
      "artist": "string",
      "year": "number",
      "thumbnail": "string",
      "cover": "string",
      "format": "string",
      "label": "string",
      "catno": "string",
      "discogsUrl": "string"
    }
  ],
  "pagination": { "page": 1, "pages": "number", "items": "number", "perPage": 100 }
}
```

**Errors:**
- `429` -- `{ "error": "Too many requests" }` with `Retry-After` and `Cache-Control: no-store` (our limiter or Discogs, only when no last-good cache exists)
- `502` -- `{ "error": "Failed to fetch from Discogs" }` with `Cache-Control: no-store` (generic; never forwards upstream text)

**Auth:** `DISCOGS_TOKEN` if present. Missing token does not 500.

**Cache:** `next: { revalidate: 300 }` and route `revalidate = 300`. Shuffle / pull one on `/collection` are client-only (Fisher-Yates in the browser; pull one uses the existing overlay/route). They add no API and do not change ISR cost. Pull one's no-JS href is one listed id picked at render. Last-good is a complete crawl only (`releases.length === pagination.items` and `items > 0`; `{releases:[], items:0}` is not last-good). When Upstash Redis env is present, that copy is stored at `lf:discogs:collection:v1` (production) or `lf:preview:discogs:collection:v1` (preview/dev) plus `…:meta:v1` and `…:lock:v1`. Preview writes are hard-guarded: a non-`main` git ref never uses the unprefixed `lf:` namespace. Reads serve Redis first so a cold instance never 429s if a snapshot exists. **A visit never writes Redis.** `/collection` and `/collection/[releaseId]` only read last-good, a fixture, or a pending shell. Listing refresh and research run only from CRON_SECRET-gated routes or `npm run crate:backfill`. There is no `vercel.json` cron. `CRON_SECRET` is not in production and must not be added without Keegan's yes. Skip Redis reads and writes entirely during `next build` (`NEXT_PHASE === 'phase-production-build'`) so `/collection` SSG stays ISR (`○` 5m) via Discogs `next.revalidate: 300`. Crate/detail Redis reads and all writes stay `cache: 'no-store'`. Missing Redis env = in-memory last-good + Discogs crawl as before. On Discogs 429 with empty Redis and empty memory: HTTP 429 + Retry-After. No webhook; 5-minute ISR is the HTML contract. Each `discogsUrl` is `https://www.discogs.com/release/<id>` with no `/release/0`.

**Prototype gap (do not hide):** Discogs API Terms of Use include a freshness clause commonly read as ~6 hours ([API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use)). This prototype keeps Redis listing last-good until a gated `/api/cron/collection-keep` run (`DISCOGS_SNAPSHOT_TTL_MS`, 24h stale) and reuses successful MusicBrainz research indefinitely (`CRATE_RESEARCH_REFRESH_MS`). ISR is `revalidate = 300`. Attribution is implemented as lowercase `discogs` plus exact-case `Data provided by Discogs.` (pressing URL on the record; `{n} releases` line and bottom of `/collection`, lecturesfrom collection URL), User-Agent, and the Discogs API non-affiliation / Zink Media trademark sentence on `/legal` Data sources (`/legal.md` twin — not HouseFooter, not Organization JSON-LD); 6-hour re-fetch of Discogs pressing payloads is **not**. That is an explicit prototype gap, not a solved freshness implementation.

**PostHog events:** `api_discogs_collection_request`, `api_discogs_error`, `api_rate_limited`

A complete collection crawl from a **gated** keep/enrich/backfill run queues new and stale release ids (`queueNewAndMissing`). Visitors never enqueue. Research facts are a standard schema (`track`, `role`, `person`, `sample_of`/`sampled_by`) with `source`, `sourceId`/`sourceUrl`, and `fetchedAt`. Precedence: MusicBrainz, then Discogs extraartists, then Wikidata (Discogs master `P1954`, then MusicBrainz release group `P436`, then Discogs release `P2206` / catalog `P5813`; more than one item is ambiguous and is not merged). Samples use `P5707` inbound and outbound. Matched-track counts stay separate from per-track credit/sample coverage; release-level facts are reported separately (`withReleaseCredits` / `withReleaseSamples`). Per-fact source labels use `.house-source` (no new colors).

---

### GET /api/cron/crate-enrich

Manual budgeted drain of the crate enrichment queue. No Vercel schedule (`vercel.json` has no `crons`). Listing last-good is Redis; gated keep refreshes when older than `DISCOGS_SNAPSHOT_TTL_MS` (24h); ISR `revalidate = 300`. Successful research is reused indefinitely (optional `CRATE_RESEARCH_REFRESH=1`, default six months). A Discogs refresh does not rematch unchanged identities.

**Auth:** `Authorization: Bearer $CRON_SECRET` compared with `timingSafeEqual`. Missing `CRON_SECRET` → HTTP 404 (route is not public). Wrong bearer → 401.

**Behavior:** If the collection listing is stale (24h), crawl and store last-good. Collection 401/403 maps to `DiscogsAuthError`, records `auth` on meta, and returns `{ skipped: true, stoppedOnAuth: true }` without `processEnrichmentQueue`. Otherwise read last-good collection, enqueue new/missing ids (dead ids stay dead unless `{ retry: true }`), `processEnrichmentQueue` until the shared deadline. MusicBrainz ~1.1s, Discogs extraartists from the already-fetched release, Wikidata SPARQL (User-Agent `lecturesfrom/1.0 +https://lecturesfrom.com ( 33@lecturesfrom.com )`, one module-level client — `lookupWikidataReleaseFacts` / `wikidataFactsFor` do not `createWikidataClient` per call, 1.1s interval, 5s timeout, honors `Retry-After`; lookup by `P1954` / `P436` / `P2206` / `P5813`). A temporary Wikidata failure (429/5xx/timeout) keeps prior Wikidata facts, sets `research.lastError`, and does not move `research.verifiedAt`. Failed refresh preserves the prior verified pressing when one exists. Worker 401/403 are `auth`: stop the run, do not increment attempts, nack `AUTH_RETRY_MS` (15 minutes). Exhausted retries (`CRATE_MAX_ATTEMPTS` 5) move to `lf:crate:dead:v1`. A worker deadline throws `WorkerDeadlineError`, nacks with backoff, and after 3 consecutive stops marks unresolved `too_slow` and **drops + discards the draft**. `too_slow` recovery is a manual `--retry`, not a visit re-queue. Draft SET uses `EX` 900s; reuse only if visitor-facts, within TTL, and `draft.lastAttemptAt` is newer than the committed pressing. Floor comparisons use `remainingBelowTakeFloor` (`remaining <= 0` or `remaining < takeFloor`). After `takeDue`, the drain re-checks the floor and nacks without a deadline stop if remaining dropped below the floor; `enrichPressing` still re-checks as a safety net. Proof drains use `ENRICH_BUDGET_MS` (45s), not the 8s take floor. Lock and inflight TTL 90s.

**Response:** `{ processed: number[], skipped: boolean, stoppedOnRateLimit: boolean, stoppedOnAuth: boolean, mbRequests: number }` or `{ processed: [], skipped: true, reason: 'no store' }` when Redis env is absent.

---

### GET /api/cron/collection-keep

Manual listing refresh. Same Bearer `CRON_SECRET` gate. If the listing snapshot is stale, crawl Discogs and write last-good. If it is fresh, drain 1 enrich item. Visitors do not ping this route. `CRON_SECRET` is not in production.

---

### GET /api/cron/crate-proof

Preview-only proof actions (`action=inspect|overlap|kill|recover|exhausted|resync|fail|auth|enrich|cleanup`). Same auth. Uses `lf:preview:` keys. Overlap concurrent drains prove lock exclusion only; concurrent `takeDue` proves inflight SET NX. Exhausted is Discogs-ok / MusicBrainz-throw through the queue. Auth proof classifies identity 401 via `probeDiscogsIdentity` in `discogs-release.ts` (does not use the live `DISCOGS_TOKEN`).

---

### GET /api/cron/crate-backfill

Resumable research backfill independent of visitor traffic. Same Bearer `CRON_SECRET` gate (missing → 404). Walks collection ids via `enrichPressing`. Query: `?ids=567894,573292&retry=1&limit=10`. `retry=1` with `ids` also `forceRefresh`. Without `ids`, `--retry` / `retry=1` retries only dead and `too_slow` ids (does not re-walk settled ids). Checkpoints a settled-id set; a missing `settled` array does **not** treat `cursor` as an index into the current id list (returns `[]`). Dead ids are skipped unless `{ retry: true }`. `remaining` is exact. Shares the enrich lock with crate-enrich.

Also: `npm run crate:backfill` (`scripts/crate-backfill.ts`) with `--ids=`, `--retry`, `--limit=`.

---

### GET /api/cron/crate-inspect

Read-only inspect of queue, dead set, unresolved set, inspect hash, backfill cursor, and last-good dumps for 573292 / 240128 / 567894. Same auth. Also: `npm run crate:inspect`.

---

### Cover sync (manual)

`npm run covers:sync -- [--ids=573292,240128 --limit=N --force --dry-run --prod]` (`scripts/covers-sync.ts`). Discovers CAA front (MB release mbid, then release group) then the largest Discogs primary image. Writes Redis manifests at `lf:preview:crate:cover:{id}:v1` (prod `lf:` only with `--prod`). Puts CAA bytes on Vercel Blob at `covers/{sha256}.{ext}` when `BLOB_READ_WRITE_TOKEN` is set; missing token no-ops. Discogs images are never uploaded. CAA/MB paced at 1.1s with User-Agent `lecturesfrom/1.0 (33@lecturesfrom.com)`. Discogs uses the existing client User-Agent plus the same interval.

---

### Crate stored pressing (Upstash)

Visitor `/collection/[releaseId]` reads stored results only (`lib/crate/read.ts`): Redis last-good (title or tracks) → committed fixtures (`573292`, `240128`, `567894`) → collection pending shell. An empty Redis error stub is not last-good; visitors see the fixture. Never live Discogs release, MusicBrainz, or Wikidata on that path, and **never a Redis write**. Cover manifests (`lf:crate:cover:{id}:v1`, preview `lf:preview:…`) are a separate Redis read (`revalidate: 300`, skip during `next build`). Missing manifest → current Discogs listing thumbnail or cover URL. Enrichment treats a committed fixture as previous when Redis has no visitor facts. The article sets `data-crate-source="redis|fixture|collection"`. Unlisted ids 404 or show collection-pending with no enqueue. Detail routes are `force-dynamic`; pressing Redis GETs use `next: { revalidate: 60 }`.

Pressing facts, sourced descriptions, and match decisions are stored separately. Every fact carries a source URL and provider id. `provenance.verifiedAt` is the last successful MusicBrainz match; `lifecycles.pressing.verifiedAt` is the last successful Discogs check; `lastAttemptAt` / `lastError` / `attempts` are failure bookkeeping. Lifecycles (`pressing` / `match` / `research`) have independent state. Coverage counts playable tracks, matched recordings, and **track-attributed** credit/sample coverage separately; release-level facts set `withReleaseCredits` / `withReleaseSamples` and do not mark every track.

MusicBrainz match order: unique Discogs URL relationship (then skip barcode/catno), else barcode/catno with score ≥95 plus similar title or track count, then artist + title + year/label. Unique-acceptable filters by score before uniqueness. No unique pressing → `unmatched` with reason `no musicbrainz release for this pressing after discogs url, barcode, catalog number, and artist + title search`. Vocal/instrumental siblings stay `ambiguous`. `CRATE_ENRICH_FAIL_IDS` (comma ids, never `*`; ignored in production and in tests) plus `deps.failRefresh` simulate a Discogs/MusicBrainz failure so a stored good pressing keeps its tracks, original `verifiedAt`, and records `lastError` + backoff. Draft writes go to a staging key and swap only on success. A weaker MusicBrainz refresh keeps the prior match unless a unique Discogs URL is counter-evidence. Descriptions paraphrase Discogs notes only. Rematch only when identity (position/title/duration/mix/`type_`) or the accepted MB release changes. `/api/cron/crate-proof` refuses when `VERCEL_ENV === 'production'`.

| Key | Purpose |
|-----|---------|
| `lf:crate:queue:v1` | Zset of release ids (score 0 = front/new; retry score = `refreshAfter`) |
| `lf:crate:queued:v1` | Dedupe set; ids leave only on ack/drop |
| `lf:crate:seen:v1` | Redis SET of ids observed in the last complete collection crawl |
| `lf:crate:enrich:lock:v1` | `SET token NX EX 60` + compare-and-delete Lua |
| `lf:crate:inflight:{id}:v1` | Taken-but-not-acked id (`SET NX EX 60`) |
| `lf:crate:visit:v1` | Visit drain throttle `SET NX EX 300` |
| `lf:crate:pressing:{id}:v1` | Stored pressing: facts, sourced description, Discogs track occurrences (incl. headings), MB release match, recordings map, provenance, lifecycles, coverage, checkpoint |
| `lf:crate:recording:{mbid}:v1` | Credits + sample relationships at recording level |
| `lf:crate:dead:v1` | SET of release ids whose retries are exhausted |
| `lf:crate:unresolved:v1` | SET of not-found / ambiguous / auth ids |
| `lf:crate:inspect:v1` | HASH of inspectable `DeadLetter` records |
| `lf:crate:backfill:v1` | Resumable backfill cursor + throughput |
| `lf:crate:cover:{id}:v1` | Cover manifest: `url`, `width`, `height`, `source` (`caa` \| `discogs`), `originalUrl`, `stored`. CAA Blob URL when uploaded; Discogs stays a hotlink. |

Preview/dev prefixes every key with `lf:preview:` (`VERCEL_ENV !== 'production'`). Never write production `lf:` keys from a preview.

Match statuses: `matched` / `ambiguous` / `unmatched` / `pending`. Weak matches and vocal/instrumental siblings stay `ambiguous`. No WhoSampled. No invented copy. Hollywood Squares sampled-in Too $hort “I’m a Player” is stored only when MusicBrainz lists the relationship.

---

### GET /api/github

Proxies to GitHub public events API. Returns aggregated activity stats for keeganmoody33.

**Auth:** None. This route does not read a GitHub token env var. Upstream calls are unauthenticated (GitHub 60 req/hr).

**Request:** No params.

**Response (200):**
```json
{
  "pushes_24h": "number",
  "pushes_7d": "number",
  "prs_recent": "number",
  "latest_repo": "string | null",
  "latest_action": "string | null",
  "latest_time": "string (ISO) | null",
  "total_events": "number"
}
```

**Errors:**
- `500` -- `{ "error": "Internal server error" }`
- `502` -- `{ "error": "Failed to fetch from GitHub" }`

**External endpoint:** `https://api.github.com/users/keeganmoody33/events/public?per_page=100`

**Caching:** 5-minute revalidation via Next.js `next: { revalidate: 300 }`

**PostHog events:** `api_github_request`, `api_github_error`

---

### POST /api/jd-analyzer

Proxies to Supabase `jd-analyzer` Edge Function.

**Request:**
```json
{
  "input": "string (required -- URL or plaintext JD)"
}
```

**Headers:** `X-POSTHOG-DISTINCT-ID` (optional)

**Response (200):**
```json
{
  "analysis": "string (structured fit analysis)"
}
```

**Analysis output format:**
- Verdict: STRONG FIT / GOOD FIT / STRETCH FIT / EXPLORATORY
- Summary
- Alignment (items)
- Growth Areas (items)
- Why Connect

**Errors:**
- `400` -- `{ "error": "Job description or URL is required" }`
- `500` -- `{ "error": "Supabase configuration missing" }` or parsed Edge Function error

**PostHog events:** `api_jd_analysis_request`, `api_jd_analysis_error`

---

## Static metadata files

House share images live in the `(house)` route group so they do **not** inherit onto `/keeganmoody33`. Nested house pages (`/catalog`, `/collection`, `/legal`, sleeves) set their own `openGraph` via `houseMetadata()`, which replaces the file-convention image — so `houseMetadata()` includes `openGraph.images` pointing at `/opengraph-image`. `personMetadata()` keeps `/og.jpg`.

| File | URL | Notes |
|------|-----|--------|
| `app/icon.svg` | `/icon.svg` | Stroke via `prefers-color-scheme` (`#20262b` light / `#ececec` dark). No `currentColor`. |
| `app/favicon.ico` | `/favicon.ico` | 16 / 32 / 48 on a `#ececec` rounded plate, mark `#20262b`. |
| `app/apple-icon.png` | `/apple-icon.png` | 180×180, solid `#ececec` ground, mark `#20262b`. |
| `app/(house)/opengraph-image.tsx` | hashed `/opengraph-image-*` | Injects house `og:image`. |
| `app/opengraph-image/route.ts` | `/opengraph-image` | Stable 1200×630 PNG from `brand/house-share.png`. |
| `app/(house)/twitter-image.tsx` | hashed `/twitter-image-*` | Injects house `twitter:image`. |
| `app/twitter-image/route.ts` | `/twitter-image` | Same still as OG. |
| `public/og.jpg` | `/og.jpg` | GTM certificate. Person metadata only (`personMetadata()`). |

Regenerate rasters with `npm run generate:brand`. Canonical vector: `brand/lecturesfrom-mark.svg`.

---

## Client-Side Integrations (No API Route)

### YouTube IFrame Player API

The `YouTubePlayer` widget loads the YouTube IFrame API directly in the browser. No server-side proxy is needed because:
- The API script is loaded from `youtube.com/iframe_api` via `next/script`
- Playlist playback uses the public playlist ID `PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk`
- No API key or authentication required
- Playback state persisted to `sessionStorage['yt-player-state']` for Phase 2 Turntable handoff

**PostHog events:** `youtube_player_loaded`, `youtube_player_play`, `youtube_player_pause`, `youtube_track_changed`

---

## Edge Functions

Both deployed via `supabase functions deploy <name>`. Source in `supabase/functions/`.

### chat/index.ts

| Aspect | Detail |
|--------|--------|
| Tables queried | `candidate_profile`, `experiences`, `skills`, `gaps_weaknesses`, `values_culture`, `faq_responses`, `ai_instructions` |
| Claude model | `claude-opus-4-5-20251101` |
| Max tokens | 1024 |
| API version | `2023-06-01` |
| System prompt | Dynamic, built from `ai_instructions` rows grouped by `instruction_type` |
| Voice | First person as Keegan |
| Secrets | `ANTHROPIC_API_KEY` (Supabase secret) |

### jd-analyzer/index.ts

| Aspect | Detail |
|--------|--------|
| Tables queried | `candidate_profile`, `experiences`, `skills`, `gaps_weaknesses`, `values_culture`, `ai_instructions` |
| Claude model | `claude-opus-4-5-20251101` |
| Max tokens | 1500 |
| API version | `2023-06-01` |
| URL scraping | Firecrawl API (`FIRECRAWL_API_KEY` Supabase secret) |
| Voice | Third person (he/his/Keegan) for recruiter audience |
| Secrets | `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY` (Supabase secrets) |

---

## Environment Variables

### Next.js (portfolio-site/.env.local)

| Variable | Scope | Required | Used By |
|----------|-------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (client + server) | Yes | `/api/chat`, `/api/jd-analyzer`, `lib/supabase.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (client + server) | Yes | `/api/chat`, `/api/jd-analyzer`, `lib/supabase.ts` |
| `NEXT_PUBLIC_POSTHOG_KEY` | Public (client + server) | No | `providers.tsx`, `lib/posthog-server.ts` |
| `NEXT_PUBLIC_POSTHOG_HOST` | Public (client only) | No | Browser ingest host (`lib/posthog-client.ts`). Defaults to `https://us.i.posthog.com`; set to `https://flow.lecturesfrom.com` once the managed proxy is live. Server analytics (`lib/posthog-server.ts`) always send to `https://us.i.posthog.com`. |
| `DISCOGS_TOKEN` | Server-only | No | `/api/discogs/collection` (sent when present; public collection works without it) |
| `KV_REST_API_URL` | Server-only | No | Durable Discogs snapshot (Vercel Marketplace Upstash for Redis). Preferred over UPSTASH_*. |
| `KV_REST_API_TOKEN` | Server-only | No | Pair with `KV_REST_API_URL`. Read-write token; do not use `KV_REST_API_READ_ONLY_TOKEN`. |
| `UPSTASH_REDIS_REST_URL` | Server-only | No | Fallback if KV_* pair is missing. |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only | No | Fallback if KV_* pair is missing. |
| `CRON_SECRET` | Server-only | No | Bearer for `/api/cron/crate-enrich`, `/api/cron/crate-backfill`, `/api/cron/crate-inspect`, `/api/cron/collection-keep`, `/api/cron/crate-proof`. Missing → 404. **Not in production. Do not add it without Keegan's yes.** |
| `CRATE_ENRICH_FAIL_IDS` | Server-only | No | Preview-only test hook. Comma-separated Discogs ids (no `*`). Ignored when `VERCEL_ENV=production` or in tests. |
| `CRATE_RESEARCH_REFRESH` | Server-only | No | Set `1` to opt into the optional MusicBrainz research refresh window (default six months via `CRATE_RESEARCH_REFRESH_MS`). Unset = reuse successful research indefinitely. |
| `BLOB_READ_WRITE_TOKEN` | Server-only | No | Vercel Blob for CAA covers. Unset = `putCoverBlob` returns null; renderer falls back to Discogs hotlink. Never commit the token. |

### Supabase Secrets (set via `supabase secrets set`)

| Variable | Used By |
|----------|---------|
| `ANTHROPIC_API_KEY` | `chat` and `jd-analyzer` Edge Functions |
| `FIRECRAWL_API_KEY` | `jd-analyzer` Edge Function (URL scraping) |

### Vercel (set in dashboard)

All Next.js env vars above must also be set in Vercel for production deployment.

---

## Validation Rules

| Route | Rule |
|-------|------|
| `/api/chat` | `question` must be non-empty string |
| `/api/jd-analyzer` | `input` must be non-empty string; URL detection via `input.trim().startsWith('http')` |
| `/api/cron/crate-enrich` | Bearer `CRON_SECRET`; missing secret 404s |
| `/api/cron/crate-backfill` | Bearer `CRON_SECRET`; missing secret 404s |
| `/api/cron/crate-inspect` | Bearer `CRON_SECRET`; missing secret 404s |
| `/api/cron/collection-keep` | Bearer `CRON_SECRET`; missing secret 404s |
| `/api/cron/crate-proof` | Bearer `CRON_SECRET`; missing secret 404s |
| Chat / JD analyzer | Missing env vars return 500 before external calls |
| Discogs routes | `DISCOGS_TOKEN` optional; missing token is not an error |

---

## Error Handling Patterns

All API routes follow the same pattern:
1. Validate env vars exist (500 if missing)
2. Validate input (400 if bad)
3. Call external service in try/catch
4. Log errors to console
5. Track errors in PostHog (`api_*_error` events with `error_type`, `error_message`)
6. Return structured JSON error response

---

## Known Issues

- `achievements` table is populated but not queried by any Edge Function
- In-memory rate limiting is per-instance (stopgap for Vercel)
- Discogs collection uses 5-minute ISR plus a durable Redis last-good snapshot when Upstash env is set; no Discogs webhook. Gated `/api/cron/collection-keep` refreshes when older than `DISCOGS_SNAPSHOT_TTL_MS` (24h). **A visit never writes Redis.** Research is manual: gated `/api/cron/crate-backfill` (`?ids=&retry=1`) and `npm run crate:backfill`. No Vercel cron. `CRON_SECRET` is not in production — do not add it without Keegan's yes. Successful research is reused (`CRATE_RESEARCH_REFRESH_MS`). **Prototype gap:** Discogs API freshness (~6h) is not implemented.
- Supabase client in `lib/supabase.ts` uses non-null assertion -- will throw if env vars missing at module load
- Deno std lib in Edge Functions pinned to `0.168.0` (~45 versions behind)

---

## Related Docs

- [PRD.md](PRD.md) -- Product definition, features, scope
- [APP_FLOW.md](APP_FLOW.md) -- Route inventory and interaction flows
- [TECH_STACK.md](TECH_STACK.md) -- Locked dependencies and external services
- [FRONTEND_GUIDELINES.md](FRONTEND_GUIDELINES.md) -- Design system, tokens, component patterns
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) -- Phased build sequence
- [progress.txt](progress.txt) -- Current completion state
- [lessons.md](lessons.md) -- Mistakes and patterns to avoid

---

*Backend Structure v1.0 -- The blueprint AI builds against, not its own assumptions.*
