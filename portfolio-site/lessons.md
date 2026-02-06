# Lessons Learned
Updated: 2026-02-05

## Schema
- Multiple SQL files in repo root reference wrong column names. Always verify against live Supabase schema before writing SQL.
- The live table is `candidate_profile` (singular), NOT `candidate_profiles` (plural).
- experiences table uses `public_bullets` (not `bullet_points`, not `key_deliverables`).

## Process
- Never paste API keys in chat or AI interfaces.
- Update progress.txt after every completed feature.
- Reference canonical docs by name in prompts, not by describing them.

## Patterns
- API proxy pattern: browser → Next.js route handler (keeps keys server-side) → external API. All new API integrations follow this pattern.
- All components are 'use client' and live in portfolio-site/components/.
- PostHog tracking is added to every API route and interactive component.

## Environment Variables
- Env var names must match exactly between .env.local and code. DISCOGS_API_TOKEN in .env.local vs DISCOGS_TOKEN in code caused a silent failure -- the API call got `undefined` with no error.
