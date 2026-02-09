# Backend Structure — lecturesfrom.com Portfolio

**Last Updated:** 2026-02-09
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
| `id` | int | PK, auto | |
| `candidate_id` | text | FK → candidate_profile.id | |
| `company_name` | text | NOT NULL | |
| `role_title` | text | NOT NULL | **NOT `title`** -- use `role_title` |
| `start_date` | date | | |
| `end_date` | date | nullable | NULL = current role |
| `duration_months` | int | | |
| `public_bullets` | text[] | ARRAY | **NOT `bullet_points`** -- use `public_bullets` |
| `private_context_what_id_do_differently` | text | | Private. Not exposed to chat. |
| `private_context_manager_would_say` | text | | Private. Not exposed to chat. |
| `display_order` | int | | Lower = higher on timeline |

**Common mistakes:**
- `exp.bullet_points` does not exist. Use `exp.public_bullets`
- `exp.title` does not exist. Use `exp.role_title`
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
| `skill_name` | text | PK or unique | |
| `category` | text | | `"strong"`, `"moderate"`, `"developing"` |
| `evidence` | text | | Concrete proof of the skill |

---

### gaps_weaknesses

Explicit limitations. Fetched by Edge Functions but **not included in public-facing chat context** (removed in Jan 2026 fix).

| Column | Type | Notes |
|--------|------|-------|
| `id` | int/uuid | PK |
| `candidate_id` | text | FK |
| `area` | text | The gap |
| `context` | text | Private framing |

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

### GET /api/discogs

Proxies to Discogs API. Returns 5 most recently added records.

**Request:** No params.

**Response (200):**
```json
[
  {
    "title": "string",
    "artist": "string",
    "year": "number",
    "thumbnail": "string (URL)",
    "discogsUrl": "string (URL)"
  }
]
```

**Errors:**
- `500` -- `{ "error": "DISCOGS_TOKEN not configured" }`
- `502` -- `{ "error": "Failed to fetch from Discogs" }`

**External endpoint:** `https://api.discogs.com/users/lecturesfrom/collection/folders/0/releases?sort=added&sort_order=desc&per_page=5&page=1`

**PostHog events:** `api_discogs_request`, `api_discogs_error`

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
| `NEXT_PUBLIC_POSTHOG_HOST` | Public (client + server) | No | Defaults to `https://us.i.posthog.com` |
| `DISCOGS_TOKEN` | Server-only | Yes | `/api/discogs` |

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
| `/api/discogs` | No input validation (GET, no params) |
| All routes | Missing env vars return 500 before external calls |

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
- No rate limiting on any API route
- No caching on Discogs route (Discogs API has its own 60 req/min limit)
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
