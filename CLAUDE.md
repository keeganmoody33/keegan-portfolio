# Keegan Moody — Portfolio Context

**Last Updated:** 2026-01-31
**Status:** Actively seeking GTM Engineer / Founding Growth roles
**Location:** Atlanta, GA or Remote

---

## Who Is This

Keegan Moody is a GTM Engineer who builds revenue infrastructure from scratch. Not campaigns — systems. The methodology, automation, and intelligence layers that make outbound repeatable.

**Headline:** GTM Engineer | Builder | Finds diamonds in dirt

**Background:** Scientist-trained (biochemistry, peer-reviewed research), blue-collar roots, sampling mentality from hip-hop production. Sees patterns others miss because he learned to work with limitations and find signal in noise.

---

## Quick Reference

| Metric | Value | Context |
|--------|-------|---------|
| Trace Air pipeline | $220K in 90 days | Greenfield territory, 78% self-sourced |
| Trace Air demos | 23 in first full month | 18 self-sourced outside CRM |
| Biofourmis | Orlando Health deal | Co-founding SDR feeding 6 AEs, fastest close in company history |
| Mixmax infrastructure | 53 warmed inboxes | ICP validation across $4.79M ARR, 9-agent AI orchestration |

---

## What He's Looking For

- **Role:** Founding GTM Engineer, Growth, Early Team Member
- **Environment:** Product-adjacent work where he can influence what gets built
- **Team:** Elite teammates who want to win
- **Style:** Autonomy with engagement, not isolation
- **Location:** Remote or Atlanta-based
- **Comp:** $120K floor, $150-180K target. Open to equity in the right situation.

---

## What He's NOT Looking For

- BDR/SDR roles (been there, building beyond that now)
- Pure cold calling without building
- Micromanagement without engagement

---

## Folder Structure

| Folder | Contents |
|--------|----------|
| `experiences/` | Role summaries with public bullets and private context |
| `ai-config/` | System prompts, AI instructions, session logs |
| `supabase/` | Edge Functions (chat, jd-analyzer), database schema |
| `portfolio-site/` | Next.js frontend |
| `Mixmax/` | GTM system docs, methodologies, playbooks |
| `certificates/` | All certifications (Anthropic, Google, Zapier, etc.) |

---

## Database Schema (Supabase)

The portfolio AI pulls from these tables:

```
candidate_profile: first_name, last_name, headline, summary, location
experiences: role_title, company_name, public_bullets (ARRAY), private_context_* fields
ai_instructions: instruction_type, instruction, content, priority
skills: skill_name, category, evidence
```

**Edge Functions:**
- `supabase/functions/chat/index.ts` — Portfolio AI chat
- `supabase/functions/jd-analyzer/index.ts` — Job description fit analyzer

**Environment Variable Conventions:**
- Env var names in `.env.local` must exactly match what the code references (e.g. `process.env.DISCOGS_TOKEN`).
- Convention: use the service's own naming (e.g. `DISCOGS_TOKEN`, not `DISCOGS_API_TOKEN`) so config and code stay in sync.
- When adding a new integration, grep the codebase for the expected var name before creating the `.env.local` entry.

---

## AI Behavior Guidelines

### Lead with Value
- They came to you. Represent someone worth talking to.
- Lead with strengths, acknowledge gaps only when directly asked.
- Ask questions to understand what visitors need.

### Tone
- Confident but humble — let the work speak
- 2-4 sentences default, longer only when asked
- Warm, direct, like talking to a smart friend

### When Asked About Gaps/Short Stints
Only address if directly asked. Frame as growth:
- "I've been increasingly intentional about fit. Looking for the right long-term home."
- "I learned that results alone aren't enough — optics and communication matter too."

**Do NOT volunteer:** firing history, self-critical language, or limitations unprompted.

---

## Key Wins (Use These)

### Trace Air
- $220K generated in 90 days from greenfield territory
- 23 demos in first fully onboarded month
- 78% self-sourced from outside the CRM
- Built territory from scratch for new AE

### Biofourmis
- Co-founding SDR feeding 6 AEs across North America
- Originated Orlando Health deal: fastest close in company history
- Enterprise healthcare: hospitals, academic medical centers

### Mixmax
- Built complete GTM infrastructure from zero
- 53-inbox email system across multiple providers
- ICP validation: 280 customers, $4.79M ARR analyzed
- 9-agent AI orchestration system (Gutenberg Framework)
- Full documentation for handoff — production-ready

---

## Growth Context (Private Layer)

Only surface when directly asked. Frame constructively.

| Topic | Frame As |
|-------|----------|
| Short stints | "Increasingly intentional about fit. Each role I've come back sharper." |
| Autonomy style | "I produce best with autonomy plus engagement — not isolation." |
| Lessons learned | "Results alone aren't enough. Now matching output with how I navigate and collaborate." |

---

## Recent Session (2026-01-31)

Fixed self-sabotaging AI behavior:
- Updated Edge Functions to use correct database columns
- Rewrote system prompts to lead with value
- Updated public_bullets for key experiences
- Deployed and tested chat + JD analyzer

See `ai-config/SESSION_LOG_2026-01-31.md` for full details.

---

*Portfolio context v3.0 — Lead with value, acknowledge gaps only when asked.*
