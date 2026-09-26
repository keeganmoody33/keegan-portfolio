# Lessons Learned

Updated: 2026-08-22

## Schema

- Multiple SQL files in repo root reference wrong column names. Always verify against live Supabase schema before writing SQL.
- The live table is `candidate_profile` (singular), NOT `candidate_profiles` (plural).
- experiences table uses `public_bullets` (not `bullet_points`, not `key_deliverables`).
- The live schema can be substantially narrower than committed documentation. On 2026-08-22, `experiences`, `skills`, and `gaps_weaknesses` lacked the documented `metrics`, `description`, `company_stage`, `company_funding`, `company_industry`, `exit_reason`, `verification_status`, `verification_sources`, `is_featured`, `years_experience`, `notes`, `created_at`, and `gap_name`-style columns.
- A migration was authored twice against columns that never existed and would have aborted. Introspect the live PostgREST OpenAPI document at `/rest/v1/` first, then write migration SQL from the observed schema instead of trusting committed docs.

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
- **When a component calls an API route, pass PostHog headers with `getPostHogDistinctIdHeader()` from `lib/posthog-client.ts`.** Chat.tsx, JDAnalyzer.tsx, GitHubActivity.tsx, and Marquee.tsx need the `X-POSTHOG-DISTINCT-ID` contract so server-side events don't silently fall back to `'anonymous_server'`. Do not call `posthog.get_distinct_id()` directly in page-load fetches; PostHog may not be initialized yet, and local/dev can otherwise send the literal string `'undefined'`.
- **Avoid non-deterministic values during SSR/client render.** `GitHubActivity` used `Math.random()` for loading skeleton bar heights, causing React hydration mismatches because the server-rendered styles did not match the client render. Use stable constants for skeleton variation.
- **Use `useId()` for DOM ids that must be stable across SSR and hydration.** `YouTubePlayer` originally generated the hidden iframe container id with `Math.random()`, which produced a different server/client `id` and caused a hydration warning even though playback still worked.
- **Check Tailwind config before adding inline styles.** `font-mono` was already mapped to Roboto Mono in `tailwind.config.js`. The first pass used inline `fontFamily` which worked but violated the project's no-inline-styles rule and duplicated config. Always grep tailwind.config for existing mappings first.
- **Error boundaries are the one exception to "no class components."** React requires error boundaries to be class components — there is no hook equivalent. When wrapping third-party or async widgets, add a lightweight error boundary that renders `null` on failure so a single widget crash never takes down the page.
- **`aria-hidden` does not remove descendants from the tab order.** BannerRotator kept inactive YouTube/GitHub panels mounted (`opacity-0`) for iframe audio. That left play/link controls focusable behind `aria-hidden` (axe `aria-hidden-focus`). Pair `aria-hidden` with `inert` on every inactive or hidden panel; drop `inert` when the panel is active. Do not render `aria-hidden="false"` on the active panel (`suppress || undefined`).
- **A hidden YouTube iframe is still in the tab order.** `aria-hidden` + `pointer-events: none` on the 1×1 wrapper does not stop Tab from entering the IFrame API embed (first stop on `/keeganmoody33`, five stops with Now Playing active). Set `inert` on the wrapper and `tabIndex = -1` on `player.getIframe()` in `onReady`. Leave the visible Play/Pause outside the wrapper so audio still works.
- **Do not leave a stale Now Playing slide after 100/101/150.** Those codes (and 2/5) mean this video cannot play. Call `nextVideo()` and count a streak. After 3 in a row, or the playlist length if shorter, `setError(true)` so BannerRotator drops the slide. Reset the streak on `onReady` and PLAYING. Keep the iframe mounted while skipping so `inert` / `tabIndex=-1` stay in place. Restricted networks often emit 150 only once — if the skip does not recover, count that toward the streak or Play stays dead with a stale title.
- **Do not pad the rotator root.** `pr-12` / `md:pr-4` on the rotator shrinks the widget background and still lets 32px dots overlap `/ 7d` from 768–1311. Keep the bar full-bleed; pad panel *content* with `pr-16` only when dots are shown so two 24×24 hit areas (`right-3` + gap-1) clear widget text.
- **Dot hit area ≠ visible dot.** A `p-1.5` button around an `h-1.5` span is only 18×18. Use a `h-6 w-6` flex hit box and keep the 6px span. Do not use negative margin to enlarge the target — that overlaps neighbors.
- **Do not force career nav onto one row at 320.** UX passed wrap: items stay `whitespace-nowrap` (no mid-label break), the nav `flex-wrap`s into rows with `gap-x-3 gap-y-2`, and nothing overflows. Forcing `flex-nowrap` or shrinking type to fit one row is a regression.
- **YouTube load timeout must start on mount.** A timeout inside Script `onLoad` never fires if the script stalls, so the skeleton can rotate 30s+. Start the 10s clock in a mount `useEffect`.
- **Keep `<footer>` a sibling of `<main>`, not nested in it.** House 404 (`HouseShell`) already does this. `/keeganmoody33` had the contact footer inside `<main>`, which nests a contentinfo landmark in the main landmark. One `<main>` on the page; footer sits beside it.
- **A rotator that keeps a null child still spends time on a blank slide.** `GitHubActivity` and `YouTubePlayer` return `null` on error; `BannerRotator` used to auto-cycle those empty slots (8s blank, 48px jump, dots on the marquee; both failing left two orphaned dots). Widgets must call `useBannerAvailability`; drop the slide and its dot. One panel = static, no dots. Zero panels = collapse the rotator. Do not rely on `ResizeObserver` once wrappers have `min-h-12` — that fakes height. `WidgetErrorBoundary` must also report unavailable, because a first-render throw never runs the child's `useEffect` cleanup.

## Component Architecture

- **Never gate a `<Script>` tag behind loading state that the script itself resolves.** The YouTubePlayer had `<Script src="youtube.com/iframe_api">` inside the "ready" return path, but `isLoading` was only set to `false` by the `onReady` callback — which required the script to have loaded. Classic deadlock on cold loads. It only worked in dev because hot-reload kept `window.YT.Player` alive from the previous render. Fix: always render the `<Script>` and hidden iframe, use a ternary for the skeleton vs. controls below them.
- **Don't read React state from callbacks that fire synchronously after `setState`.** `persistState` captured `playing` from its `useCallback` closure, then `onStateChange` called `setPlaying(true)` and immediately `persistState()`. The closure still held the old value because `setState` is async. Fix: read the authoritative value from the source-of-truth API (`player.getPlayerState()`) instead of React state. This also removes the state variable from the dependency array, making the callback a stable reference.
- **Banner widgets should be single-row, inline-label layouts.** The original RecentDigs used `flex-1 aspect-square` covers (~250px each on desktop) with metadata text below, consuming massive vertical space. The fix: fixed-width thumbnails (72px desktop / 60px mobile), inline labels, no metadata text (title on hover). Same pattern for GitHubActivity: label + chart + push count all on one row.
- **When rotating widgets that contain iframes/scripts, keep all children mounted.** BannerRotator uses `opacity-0 absolute pointer-events-none` for inactive panels instead of `display: none` or conditional rendering. This is critical for YouTubePlayer — the hidden YouTube iframe must stay in the DOM for audio to continue playing when the panel rotates away. Using `hidden` or unmounting would kill the audio stream.
- **`YT.Player` replaces its target `<div>` with an `<iframe>`; `destroy()` removes it from the DOM entirely.** React doesn't know the element was removed (it happened outside the reconciler), so it won't re-create it. In strict mode (mount → cleanup → mount), `destroy()` in the cleanup leaves no container for the second `initPlayer()` call, causing silent failure. Fix: before calling `new YT.Player(id, ...)`, check `document.getElementById(id)` and re-create the element inside a wrapper ref if missing.

## Local Development

- **The dev server serves the portfolio at `/`, not `/keeganmoody33`.** The `/keeganmoody33` path is a Vercel rewrite that only exists in production. Locally, navigate to `http://localhost:3000`. The `next.config.js` has no rewrites configured.

## Environment Variables

- Env var names must match exactly between .env.local and code. DISCOGS_API_TOKEN in .env.local vs DISCOGS_TOKEN in code caused a silent failure -- the API call got `undefined` with no error.
- **Discogs is a house surface.** `/api/discogs/collection` paginates the full crate for `/collection`. Do not re-add Recent Digs or `/api/discogs` (recent-5) to `/keeganmoody33`. Do not collapse the full-crate API into a recent-5 list.
- **`DISCOGS_TOKEN` is optional** for the public `lecturesfrom` collection. Requiring it 500s `/collection` in previews that lack the env. User-Agent must be `lecturesfrom/1.0` on every Discogs request.

## Database Content Management

- **Enriching DB bullets doesn't change the website display** — the Timeline component renders `public_bullets` as a joined paragraph. Adding more bullets to the array makes the paragraph longer on the site. If you want richer chat context without changing the website, you'd need a separate column (e.g. `chat_bullets`). For now, the enriched bullets serve both.
- **Never execute SQL before an audit gate.** `DATABASE_UPDATES.md` was shipping `INSERT` statements with wrong column names (`company`, `role`, `description`, `honest_context`) and the wrong table name (`candidate_profiles`). Always cross-check markdown claims, mark verified vs. unverified metrics, and produce a single consolidated migration file for owner sign-off.
- **Use `display_order >= 100` for chat-only rows.** Mercer University and Community Ambulance are in the database for AI chat context but shouldn't dominate the timeline. Camp Horizon is at 99, so anything 100+ sorts after it.
- **When the Supabase MCP times out, the REST API still works.** `curl` against `NEXT_PUBLIC_SUPABASE_URL/rest/v1/` with the anon key is reliable for reads. For writes, you need either the MCP (with correct `project_ref` and `read_only=false`) or `psql` with the database password.
- **Cross-verify Supabase data against the resume periodically.** Dates, titles, and bullet content drift over time as different sessions make different updates. The resume is the source of truth — run a comparison at least once a month.

## MCP / External Tool Config

- **Supabase MCP `project_ref` must match `.env.local`.** The Cursor MCP config (`~/.cursor/mcp.json`) had `project_ref=krywcgrrrdpudysphgbp` while the actual project was `cvkcwvmlnghwwvdqudod`. This caused "Connection timeout" on SQL queries and "Project not found" on every other MCP call. The error messages gave no hint that the project ref was wrong — it looked like a network issue. When Supabase MCP fails, check `project_ref` in `~/.cursor/mcp.json` against `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` first.
- **Set `read_only=false` in the MCP URL if you need to write SQL.** The default Supabase MCP setup URL uses `read_only=true`, which silently blocks mutations. If you're planning to run INSERT/UPDATE/DELETE via MCP, flip it before you start.

## Descoped Features

- Worthy Reads widget and Alan Iverson chat persona were cancelled on 2026-07-24. Both have been removed from all planning docs. Do not reintroduce them without explicit request.

## Edge Function Deployment

- **`import { serve } from "https://deno.land/std@0.168.0/http/server.ts"` is deprecated.** Use the built-in `Deno.serve()` instead. The std/http server module was the old pattern; modern Deno has `Deno.serve` as a global. Both Edge Functions were updated 2026-07-24.
- **Pin `@supabase/supabase-js` in Edge Functions.** The original used `@2` (floating major). Pin to a patch version (e.g. `@2.90.1`) for reproducibility — matches the version in package.json.
- **`request.ip` is not in the standard `NextRequest` type.** Next.js exposes it at runtime but TypeScript doesn't know about it. Use `(request as NextRequest & { ip?: string }).ip` to access it without TS errors. The rate-limit.ts helper handles this; API routes that reference `request.ip` directly in PostHog properties need the same cast.
- **In-memory rate limiting is a stopgap for Vercel.** Each serverless instance has its own memory, so rate limits won't be accurate across multiple instances. Acceptable for a low-traffic portfolio site. For production-grade, use Upstash Redis or Vercel KV.
- **Always grep all docs after cancelling a feature.** Cancelling Worthy Reads + Alan Iverson required edits across 10+ files (PRD, IMPLEMENTATION_PLAN, BANNER_WIDGETS_SPEC, AURA_PROMPTS, AURA_PROMPTS_V2, DESIGN_PLAYBOOK, TURNTABLE_LOADING_SPEC, NAVIGATION_PATHWAYS_SPEC, HUMAN_MACHINE_TOGGLE_SPEC, lessons.md, progress.txt). The first subagent pass missed references in spec docs that weren't in the original task list. A final grep caught them.
