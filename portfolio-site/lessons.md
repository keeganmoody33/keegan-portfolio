# Lessons Learned
Updated: 2026-02-10

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

## Component Architecture
- **Never gate a `<Script>` tag behind loading state that the script itself resolves.** The YouTubePlayer had `<Script src="youtube.com/iframe_api">` inside the "ready" return path, but `isLoading` was only set to `false` by the `onReady` callback — which required the script to have loaded. Classic deadlock on cold loads. It only worked in dev because hot-reload kept `window.YT.Player` alive from the previous render. Fix: always render the `<Script>` and hidden iframe, use a ternary for the skeleton vs. controls below them.
- **Don't read React state from callbacks that fire synchronously after `setState`.** `persistState` captured `playing` from its `useCallback` closure, then `onStateChange` called `setPlaying(true)` and immediately `persistState()`. The closure still held the old value because `setState` is async. Fix: read the authoritative value from the source-of-truth API (`player.getPlayerState()`) instead of React state. This also removes the state variable from the dependency array, making the callback a stable reference.
- **Banner widgets should be single-row, inline-label layouts.** The original RecentDigs used `flex-1 aspect-square` covers (~250px each on desktop) with metadata text below, consuming massive vertical space. The fix: fixed-width thumbnails (72px desktop / 60px mobile), inline labels, no metadata text (title on hover). Same pattern for GitHubActivity: label + chart + push count all on one row.
- **When rotating widgets that contain iframes/scripts, keep all children mounted.** BannerRotator uses `opacity-0 absolute pointer-events-none` for inactive panels instead of `display: none` or conditional rendering. This is critical for YouTubePlayer — the hidden YouTube iframe must stay in the DOM for audio to continue playing when the panel rotates away. Using `hidden` or unmounting would kill the audio stream.
- **`YT.Player` replaces its target `<div>` with an `<iframe>`; `destroy()` removes it from the DOM entirely.** React doesn't know the element was removed (it happened outside the reconciler), so it won't re-create it. In strict mode (mount → cleanup → mount), `destroy()` in the cleanup leaves no container for the second `initPlayer()` call, causing silent failure. Fix: before calling `new YT.Player(id, ...)`, check `document.getElementById(id)` and re-create the element inside a wrapper ref if missing.

## Environment Variables
- Env var names must match exactly between .env.local and code. DISCOGS_API_TOKEN in .env.local vs DISCOGS_TOKEN in code caused a silent failure -- the API call got `undefined` with no error.

## Database Content Management
- **Enriching DB bullets doesn't change the website display** — the Timeline component renders `public_bullets` as a joined paragraph. Adding more bullets to the array makes the paragraph longer on the site. If you want richer chat context without changing the website, you'd need a separate column (e.g. `chat_bullets`). For now, the enriched bullets serve both.
- **Use `display_order >= 100` for chat-only rows.** Mercer University and Community Ambulance are in the database for AI chat context but shouldn't dominate the timeline. Camp Horizon is at 99, so anything 100+ sorts after it.
- **When the Supabase MCP times out, the REST API still works.** `curl` against `NEXT_PUBLIC_SUPABASE_URL/rest/v1/` with the anon key is reliable for reads. For writes, you need either the MCP (with correct `project_ref` and `read_only=false`) or `psql` with the database password.
- **Cross-verify Supabase data against the resume periodically.** Dates, titles, and bullet content drift over time as different sessions make different updates. The resume is the source of truth — run a comparison at least once a month.

## MCP / External Tool Config
- **Supabase MCP `project_ref` must match `.env.local`.** The Cursor MCP config (`~/.cursor/mcp.json`) had `project_ref=krywcgrrrdpudysphgbp` while the actual project was `cvkcwvmlnghwwvdqudod`. This caused "Connection timeout" on SQL queries and "Project not found" on every other MCP call. The error messages gave no hint that the project ref was wrong — it looked like a network issue. When Supabase MCP fails, check `project_ref` in `~/.cursor/mcp.json` against `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` first.
- **Set `read_only=false` in the MCP URL if you need to write SQL.** The default Supabase MCP setup URL uses `read_only=true`, which silently blocks mutations. If you're planning to run INSERT/UPDATE/DELETE via MCP, flip it before you start.
