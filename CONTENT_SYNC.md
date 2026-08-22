# Content Sync Pipeline

**Updated:** 2026-08-22

This doc defines the single source of truth and recurring cadence for keeping the portfolio Supabase database in sync with the repo's career content.

## Pipeline

```
experience markdown (experiences/*.md)
        |
        v
   audit gate
   - cross-check claims vs evidence
   - flag unverified metrics
   - write honest_context caveats
        |
        v
   SQL migration
   - use live schema from archive/sql/insert_data.sql
   - make INSERT/UPDATE idempotent with ON CONFLICT (id)
   - consolidate in sql/YYYY-MM-DD_description.sql
        |
        v
   owner sign-off
        |
        v
   execute in Supabase
        |
        v
   verify live site
   - Timeline renders new roles in correct order
   - chat surfaces new skills with right buckets
   - no unverified claims appear as closed facts
```

## Checklist Per New Role

- [ ] Write or update `experiences/XX-slug.md` with public bullets + honest context.
- [ ] Cross-check every metric against the resume and any supporting docs.
- [ ] Add a row to `DATABASE_UPDATES.md` audit table: verified vs unverified.
- [ ] Write the `INSERT INTO experiences ... ON CONFLICT (id)` statement using the live column set (`company_name`, `role_title`, `public_bullets` `TEXT[]`, `private_context_what_id_do_differently`, `metrics` `JSONB`, `display_order`, etc.).
- [ ] If skills changed, update `skills` with `category` as the chat bucket (`strong`/`moderate`/`developing`/`gap`) and `proficiency_level` as the descriptive label.
- [ ] If the coding or another gap moved, update `gaps_weaknesses`.
- [ ] Open a PR; do **not** execute SQL in production without owner sign-off.
- [ ] After merge, run the migration in Supabase and verify the live Timeline and chat.

## Cadence

- **After every engagement ends** (or at least monthly), review `experiences/*.md` for new roles worth adding.
- **After every significant project or skill shift**, update the skills matrix and any relevant gap.
- **Quarterly**, audit the live DB rows against the resume and `experiences/*.md` to catch drift.

## Canonical References

- Resume: `profile/KMOODY_02-2026_RESUME.md`
- Experience markdown: `experiences/*.md`
- Live schema reference: `archive/sql/insert_data.sql`
- Migration directory: `sql/`
- Status tracker: `DATABASE_UPDATES.md`
- Project status: `PROJECT_CONTEXT.md`

## Hard Rules

1. **No DB writes before audit and sign-off.**
2. **No unverified metric appears without a caveat.**
3. **One migration file per sync batch.**
4. **Schema-first:** always re-read `archive/sql/insert_data.sql` and `portfolio-site/BACKEND_STRUCTURE.md` before writing SQL.
