---
name: Test lecturesfrom.com Vercel previews
scope: When testing Vercel preview deployments of the keegan-portfolio Next.js site
description: How to verify the lecturesfrom.com portfolio preview builds, loads, and renders the Supabase-backed Timeline correctly when Vercel Authentication blocks direct preview access.
---

# Testing lecturesfrom.com Vercel previews

## Background

- The Next.js app lives in `portfolio-site/` and is deployed to a Vercel project tied to the `lecturesfromog` team.
- Vercel preview deployments for this project are protected by **Vercel Authentication** (SSO). Direct browser/curl access returns `302` to `vercel.com/sso-api` then `403`.
- The production custom-domain deployment at `https://www.lecturesfrom.com/keeganmoody33` is public and can be used as a functional proxy when the PR only changes documentation/SQL (no frontend code).
- The page is a client-side Next.js App Router page (`'use client'`) that fetches `candidate_profile` and `experiences` from Supabase in `useEffect`.

## Quick test checklist

1. Get the preview URL from GitHub deployment status, e.g.
   ```bash
   curl -s "https://api.github.com/repos/keeganmoody33/keegan-portfolio/statuses/<HEAD_SHA>" | grep -o 'https://[^"]*\.vercel\.app'
   ```
   Expect the deployment `state` to be `success`.

2. Verify the preview is protected, not broken:
   ```bash
   curl -sI "https://<preview-url>/keeganmoody33"
   ```
   Should return `302` to `vercel.com/sso-api`, not a 5xx. This confirms the build succeeded.

3. If direct preview access is not available, use the public production deployment as a proxy:
   ```text
   https://www.lecturesfrom.com/keeganmoody33
   ```

4. Wait for the client-side Supabase fetch before asserting Timeline content; the initial SSR HTML shows `Loading experiences...`.

5. Capture ground truth from the live Supabase instance by extracting the public anon key from a `_next/static/chunks/*.js` bundle (the key and `NEXT_PUBLIC_SUPABASE_URL` are bundled for client use). Then query:
   ```bash
   curl -s "https://<project>.supabase.co/rest/v1/experiences?candidate_id=eq.keegan-moody-001&select=id,company_name,role_title,display_order,public_bullets&order=display_order.asc" \
     -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
   ```
   This gives the exact order and content the UI should render.

6. Use browser find (`Ctrl+F`) to confirm the four new/existing role names are absent until the migration is run:
   - `Kivira`
   - `Morph Data Strategies`
   - `AssetMule`
   - `BariTotalCare` / `BCOFA 2025`

## Common issues / caveats

- Timeline data is **not** in the initial SSR HTML; screenshots taken immediately after navigation may still say `Loading experiences...`. Wait 5–10 seconds or poll the DOM for rendered `<h4>` headings inside `.experience-card` elements.
- The hero name uses `opacity-0` initial state and animates in; it may not be fully visible until the spray-text animation completes (≈ 500 ms).
- Chrome for Testing shows a banner at the top; it does not affect page behavior.
- Expected console baseline: one `favicon.ico` 404 and `web-share` / YouTube postMessage-origin warnings. These are pre-existing and unrelated to doc-only changes. Any `Hydration failed` / `Minified React error` is a real regression.

## Devin secrets needed

- None for the production proxy or the public Supabase query.
- `VERCEL_TOKEN` or a Vercel team login is needed only if the preview is protected and the user wants the preview itself opened in a browser. If unavailable, fall back to the production deployment and document the SSO blocker.
