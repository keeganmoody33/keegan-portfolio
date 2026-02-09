# Lessons Learned
Updated: 2026-02-09

## Schema
- Multiple SQL files in repo root reference wrong column names. Always verify against live Supabase schema before writing SQL.
- The live table is `candidate_profile` (singular), NOT `candidate_profiles` (plural).
- experiences table uses `public_bullets` (not `bullet_points`, not `key_deliverables`).

## Process
- Never paste API keys in chat or AI interfaces.
- Update progress.txt after every completed feature.
- Reference canonical docs by name in prompts, not by describing them.
- **Documentation first, code second.** Create/update canonical docs before starting implementation work. The six canonical docs (PRD, APP_FLOW, TECH_STACK, FRONTEND_GUIDELINES, BACKEND_STRUCTURE, IMPLEMENTATION_PLAN) are the contract -- any AI that reads them can't hallucinate column names, invent dependencies, or guess at routing.
- **After every major session, check for stale references across all docs.** When one doc changes (e.g. DESIGN_PLAYBOOK.md folded into FRONTEND_GUIDELINES.md), grep all other docs for the old filename. Two docs disagreeing erodes trust faster than no docs at all.
- **Don't reference files that don't exist yet.** FEATURE_FLAGS.md was referenced in IMPLEMENTATION_PLAN.md before it was created. Remove references until the file exists.

## Content Source of Truth
- **The resume (`profile/KMOODY_02-2026_RESUME.md`) is the single source of truth for experience content** — role titles, company names, dates, and bullet text. Do not overwrite or regenerate experience markdown files (e.g. `experiences/01-mixmax.md`, `02-mobb-ai.md`) from other sources (e.g. `role_templates_public_private.md`) without aligning to the resume first. We introduced wrong Mixmax bullets and wrong Mobb AI dates by regenerating from `role_templates_public_private.md` instead of the resume.
- When in doubt about role dates or bullet text, check the resume before making changes. It is the most current and verified document.
- **The portfolio chat reads only from the Supabase database** (`candidate_profile`, `experiences.public_bullets`, `ai_instructions`, etc.) — it does NOT read `experiences/*.md` or any markdown files. Editing experience markdown does not change chat behavior or sentiment. Only DB content and `ai_instructions` rows control what the chat says.

## Patterns
- API proxy pattern: browser → Next.js route handler (keeps keys server-side) → external API. All new API integrations follow this pattern.
- All components are 'use client' and live in portfolio-site/components/.
- PostHog tracking is added to every API route and interactive component.
- **When a component calls an API route, pass `X-POSTHOG-DISTINCT-ID: posthog.get_distinct_id()` in the request headers.** Chat.tsx and JDAnalyzer.tsx both do this. RecentDigs.tsx was built without it — server-side events silently fell back to `'anonymous_server'` instead of the real user. The fetch worked fine, so the bug was invisible unless you checked PostHog. Treat header forwarding as part of the API proxy contract, not optional.
- **Check Tailwind config before adding inline styles.** `font-mono` was already mapped to Roboto Mono in `tailwind.config.js`. The first pass used inline `fontFamily` which worked but violated the project's no-inline-styles rule and duplicated config. Always grep tailwind.config for existing mappings first.
- **Error boundaries are the one exception to "no class components."** React requires error boundaries to be class components — there is no hook equivalent. When wrapping third-party or async widgets, add a lightweight error boundary that renders `null` on failure so a single widget crash never takes down the page.

## Environment Variables
- Env var names must match exactly between .env.local and code. DISCOGS_API_TOKEN in .env.local vs DISCOGS_TOKEN in code caused a silent failure -- the API call got `undefined` with no error.

## MCP / External Tool Config
- **Supabase MCP `project_ref` must match `.env.local`.** The Cursor MCP config (`~/.cursor/mcp.json`) had `project_ref=krywcgrrrdpudysphgbp` while the actual project was `cvkcwvmlnghwwvdqudod`. This caused "Connection timeout" on SQL queries and "Project not found" on every other MCP call. The error messages gave no hint that the project ref was wrong — it looked like a network issue. When Supabase MCP fails, check `project_ref` in `~/.cursor/mcp.json` against `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` first.
- **Set `read_only=false` in the MCP URL if you need to write SQL.** The default Supabase MCP setup URL uses `read_only=true`, which silently blocks mutations. If you're planning to run INSERT/UPDATE/DELETE via MCP, flip it before you start.
