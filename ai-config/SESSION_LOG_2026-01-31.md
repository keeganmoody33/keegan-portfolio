# Portfolio AI Fix Session - January 31, 2026

## Problem
The portfolio AI chat and JD analyzer were self-sabotaging — volunteering weaknesses, mentioning firing history, using phrases like "drowned in autonomy" when employers visited.

## Root Causes Identified
1. **Content designed for "radical honesty"** — system prompts led with confessions instead of value
2. **Edge Functions querying non-existent database columns** — code referenced `profile.name`, `profile.title`, `exp.bullet_points` which don't exist in the actual schema

## Actual Database Schema (Discovered via Diagnostic)
```
candidate_profile:
  - id, first_name, last_name, email, location
  - headline (NOT title)
  - summary (NOT elevator_pitch, career_narrative, looking_for)
  - linkedin_url, github_url, portfolio_url, created_at, updated_at

experiences:
  - id, candidate_id, company_name, role_title (NOT title)
  - start_date, end_date, duration_months, location, employment_type
  - public_bullets (ARRAY) — NOT bullet_points
  - private_context_what_id_do_differently
  - private_context_manager_would_say
  - display_order, company_url

ai_instructions:
  - id, candidate_id, created_at
  - instruction_type, instruction, priority, content
```

## Files Modified

### 1. supabase/functions/chat/index.ts
**Changes:**
- `profile?.name` → `${profile.first_name} ${profile.last_name}`
- `profile?.title` → `profile.headline`
- `exp.bullet_points` → `exp.public_bullets`
- Removed `honest_notes` from skills display
- Removed "gap" skills category from display (don't volunteer weaknesses)
- Removed private_context fields from public-facing output

### 2. supabase/functions/jd-analyzer/index.ts
**Changes:**
- Same column fixes as chat
- `profile.name` → `${profile.first_name} ${profile.last_name}`
- `profile.title` → `profile.headline`
- `profile.looking_for` / `profile.not_looking_for` → removed (doesn't exist)
- `exp.bullet_points` → `exp.public_bullets`

### 3. Database Updates (via SQL)
**File:** `SUPABASE_UPDATE_CORRECT_SCHEMA.sql`

**ai_instructions** — New system prompt:
- Lead with value, not confessions
- Only address gaps when directly asked
- Frame growth areas constructively
- 2-4 sentence responses by default
- Ask questions back to engage visitors

**candidate_profile** — Updated:
- headline: "GTM Engineer | Builder | Finds diamonds in dirt"
- summary: New positioning paragraph with comp expectations ($120K floor, $150-180K target)

**experiences** — Updated public_bullets for:
- Trace Air: $220K in 90 days, 23 demos, 78% self-sourced
- Biofourmis: Co-founding SDR, Orlando Health deal, 6 AEs
- Mixmax: GTM infrastructure from zero, 53-inbox system, ICP validation

## New Positioning Framework

### Core Identity
"GTM Engineer. Builder. Hunter. Finds diamonds in dirt."

### What He's Looking For
- Founding GTM Engineer / Growth / Early Team Member
- Product-adjacent work (influence what gets built)
- Elite teammates who want to win
- Autonomy with engagement, not isolation
- Remote or Atlanta-based
- $120K floor, $150-180K target

### What He's NOT Looking For
- BDR/SDR roles
- Pure cold calling without building
- Micromanagement without engagement

### How to Handle Tough Questions
| Question | Old Response | New Response |
|----------|--------------|--------------|
| "Why short stints?" | "I've been fired twice, drowned in autonomy" | "I've been increasingly intentional about fit. Looking for the right long-term home." |
| "What are your weaknesses?" | Volunteered unprompted | Only address if asked directly, frame as growth |
| "Resume gaps?" | Over-explained with self-blame | "I was being selective about the next move" |

## Deployment Steps Completed
1. ✅ Ran SUPABASE_UPDATE_CORRECT_SCHEMA.sql in Supabase SQL Editor
2. ✅ Verified updates with SELECT queries
3. ✅ Deployed Edge Functions: `supabase functions deploy chat` and `jd-analyzer`
4. ✅ Tested chat with edge cases — passed
5. ✅ Tested JD analyzer — returned "STRONG FIT" with value-forward framing

## Test Results

### Chat Tests Passed:
- "What are you looking for?" → Led with value, asked question back
- "Gaps in resume?" → Framed as being selective, no firing mention
- "Are you gay?" → Boundary handled clean
- Calendar conversion → Worked naturally

### JD Analyzer Test Passed:
- Returned "STRONG FIT"
- 7 alignment points with green checkmarks
- Growth areas framed constructively (not as weaknesses)
- Ended with "Why Connect" call to action

## Files Created This Session
- `SUPABASE_UPDATE_2026-01-31.sql` (first attempt, had errors)
- `SUPABASE_UPDATE_FIXED.sql` (second attempt, still had errors)
- `SCHEMA_DIAGNOSTIC.sql` (to discover actual schema)
- `SUPABASE_UPDATE_CORRECT_SCHEMA.sql` (final working version)
- `ai-config/SESSION_LOG_2026-01-31.md` (this file)

## Content Files Updated (in ai-config/)
- system-prompts.md — New tone/guidelines
- common-questions.md — Better questions, positive framing
- values-and-preferences.md — Forward-looking, updated comp
- gaps-and-weaknesses.md — Renamed concept to "Growth Context"
- basic-info.md — New positioning statement
