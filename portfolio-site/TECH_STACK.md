# Tech Stack — Portfolio Site

**Do not add dependencies not listed here without explicit approval.**

---

## Production Dependencies

All versions are pinned from `portfolio-site/package-lock.json`.

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | Framework: App Router, API routes, server/client components |
| react | 19.2.4 | UI library |
| react-dom | 19.2.4 | React DOM renderer |
| @supabase/supabase-js | 2.90.1 | Supabase client; queries candidate_profile, experiences, etc. |
| posthog-js | 1.336.4 | Client-side analytics (components, page events) |
| posthog-node | 5.21.2 | Server-side analytics (API routes via lib/posthog-server.ts) |

---

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | 5.9.3 | Type checking, TS config |
| @types/node | 20.19.30 | Node.js type definitions |
| @types/react | 19.2.10 | React type definitions |
| @types/react-dom | 19.2.3 | React DOM type definitions |
| tailwindcss | 3.4.19 | Utility CSS, design tokens |
| postcss | 8.5.6 | CSS processing pipeline |
| autoprefixer | 10.4.23 | Vendor prefixes for CSS |

---

## Supabase Edge Functions (Deno)

Runtime: **Deno**. Imports use URL specifiers with pinned versions where available.

| Import URL | Pinned Version | Purpose |
|------------|----------------|---------|
| https://deno.land/std@0.168.0/http/server.ts | 0.168.0 | HTTP server (serve) |
| https://esm.sh/@supabase/supabase-js@2 | @2 only (no patch) | Supabase client in Edge Functions |

**Note:** `@supabase/supabase-js@2` is not patch-pinned; consider pinning to a specific version (e.g. 2.90.1) for reproducibility.

---

## External APIs

| Service | Endpoint | Auth Method | Env Variable |
|---------|----------|-------------|--------------|
| Anthropic Claude | https://api.anthropic.com/v1/messages | Header: `x-api-key` | ANTHROPIC_API_KEY (Supabase secrets) |
| Firecrawl | https://api.firecrawl.dev/v1/scrape | Header: `Authorization: Bearer <token>` | FIRECRAWL_API_KEY (Supabase secrets) |
| PostHog | https://us.i.posthog.com | Project key in client init | NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST |
| Discogs | https://api.discogs.com | Header: `Authorization: Discogs token=<token>`, User-Agent required | DISCOGS_TOKEN (Next.js env) |
| Supabase | NEXT_PUBLIC_SUPABASE_URL/functions/v1/* | Header: `Authorization: Bearer <anon_key>` | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY |

**Discogs (new):** `api.discogs.com`; auth via personal token; env var `DISCOGS_TOKEN`. Used for Recent Digs widget (collection endpoint).

---

## Supabase

- **Project:** PostgreSQL + Edge Functions
- **Edge Functions runtime:** Deno
- **Tables used by app:** candidate_profile, experiences, skills, gaps_weaknesses, values_culture, faq_responses, ai_instructions
- **Edge Functions:** `chat`, `jd-analyzer` (deployed via `supabase functions deploy`)

---

## Deployment

- **Platform:** Vercel
- **Live URL:** lecturesfrom.com/keeganmoody33 (rewrites in vercel.json: `/` → `/keeganmoody33`, `/keeganmoody33` → `/`)
- **Build:** Next.js (`next build`); auto-deploy on push to main
