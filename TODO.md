# Keegan Portfolio - Master To-Do List

**Last Updated:** January 20, 2026

---

## 🔥 Priority 1: Fix What's Broken

### AI Response Refinement
- [ ] **Shorten AI responses** — Currently too long and verbose
- [ ] **Adjust tone** — Less "roast-y", more matter-of-fact honest
- [ ] **Update ai_instructions table** — New system prompt for shorter, calmer responses
- [ ] **Remove "Has Keegan ever been fired?" prompt** — Replace with neutral questions

### Suggested Chat Questions (Replace Current Ones)
- [ ] "What are you working on right now?"
- [ ] "What's your background?"
- [ ] "What kind of roles are you looking for?"
- [ ] "Tell me about the Mixmax project"
- [ ] "What are your actual skill gaps?"

---

## 📊 Priority 2: Add Mixmax Data

### Database Updates (experiences table)
- [ ] Add Mixmax role: "Founding GTM Engineer" (Aug-Dec 2025)
- [ ] Key accomplishment: Built GTM Intelligence System from scratch
- [ ] Key accomplishment: Validated ICP with 280 customers, $4.79M ARR
- [ ] Key accomplishment: Created "The Volley Method" — dual-source validation
- [ ] Key accomplishment: Debunked "26% ghost statistic" with audit trail
- [ ] Key accomplishment: Built 9-agent specialist system (Gutenberg Framework)
- [ ] Key accomplishment: Produced portable methodology for future operators

### Validated Stats to Add (from CORRECTED_STATISTICS_QUICK_REFERENCE.md)
- [ ] 280 paying customers analyzed
- [ ] $4.79M total ARR mapped
- [ ] 43 classified case studies with usage guidelines
- [ ] 51-200 employee band = optimal target (32.9% of accounts, $12,674 avg ARR)
- [ ] Dual-motion strategy: Volume (51-200) + Value (201-1000) + Enterprise (1000+)

### Files to Reference
- `MIXMAX_narrative_brief.md` — Executive summary
- `GTM_INTELLIGENCE_SYSTEM.md` — Full methodology (1085 lines)
- `MIXMAX_GTM_INTELLIGENCE_COMPENDIUM.md` — Detailed findings
- `CORRECTED_STATISTICS_QUICK_REFERENCE.md` — Validated numbers only

---

## 🛠️ Priority 3: Update Skill Gaps

### gaps_weaknesses Table Updates
- [ ] **Coding** — Change from "hard limitation" to "actively developing"
  - Evidence: Built this portfolio site with Next.js, TypeScript, Supabase
  - Evidence: Working with Edge Functions, API integrations
- [ ] **Product sense** — Add as emerging strength, not gap
  - Evidence: Built GTM Intelligence System with product thinking
  - Evidence: Designed portable methodology for reuse

### skills Table Updates
- [ ] Add: TypeScript (beginner → intermediate)
- [ ] Add: React/Next.js (beginner)
- [ ] Add: Supabase/PostgreSQL (beginner)
- [ ] Add: API integration (intermediate)
- [ ] Update: System design (intermediate) — proven at Mixmax

---

## 🎨 Priority 4: Design & UI Updates

### Allen Iverson Design Implementation
- [ ] Get design files from Keegan
- [ ] Implement military/construction color palette:
  - Army green
  - Hi-vis yellow/orange
  - Desert tan
  - Navy blue
  - Silver reflective accents
- [ ] Make layout less centered, more dynamic/asymmetric
- [ ] Remove or tone down stats cards (braggadocious)
- [ ] Update typography

### Hero Section
- [ ] Rewrite copy — calm, cool, not prideful
- [ ] Position: GTM engineering + product curiosity
- [ ] No one-liners, no "I'm the shit" energy
- [ ] Let the work speak

---

## 🐰 Priority 5: New Features

### Discogs Feature (Rabbit Hole Project)
- [ ] Define scope and purpose
- [ ] Design data model
- [ ] Build UI
- [ ] Integrate with portfolio

### JD Analyzer Improvements
- [ ] Test with real job postings
- [ ] Verify Firecrawl URL scraping works
- [ ] Improve analysis output format
- [ ] Add fit score visualization

---

## 🗄️ Database Schema Reference

```sql
-- Tables in Supabase (cvkcwvmlnghwwvdqudod)
candidate_profiles  -- Basic profile info
experiences         -- Work history with honest context
skills              -- Skills matrix with proficiency levels
achievements        -- Quantified accomplishments
ai_instructions     -- System prompts and personality guidelines
gaps_weaknesses     -- Hard limitations, learnable weaknesses, anti-patterns
```

---

## 📝 SQL Commands to Run (When Ready)

### Update AI Instructions for Shorter Responses
```sql
UPDATE ai_instructions 
SET content = 'You are Keegan''s portfolio AI. Be direct and brief. 

RESPONSE LENGTH: 2-3 sentences max unless asked for detail.
TONE: Matter-of-fact, not roast-y. Honest without being harsh.
STYLE: Like talking to a friend, not a recruiter.

When discussing gaps: State them plainly. No drama.
When discussing strengths: Let the work speak. No bragging.
When fit is bad: Say so directly. "This probably isn''t a fit because..."

You have access to Keegan''s real work history, skills, and honest assessments of gaps.'
WHERE instruction_type = 'system_prompt';
```

### Add Mixmax Experience
```sql
INSERT INTO experiences (company, role, start_date, end_date, description, honest_context)
VALUES (
  'Mixmax',
  'Founding GTM Engineer',
  '2025-08-01',
  '2025-12-31',
  'Built GTM Intelligence System from scratch. Validated ICP across 280 customers ($4.79M ARR). Created "The Volley Method" for dual-source validation. Debunked ghost statistics with audit trails. Produced portable methodology for future operators.',
  'Short engagement (5 months). Built systems and methodology but didn''t stay to see full execution results. The work is solid and documented, but I can''t claim revenue outcomes from campaigns I didn''t run.'
);
```

### Update Coding Skill Gap
```sql
UPDATE gaps_weaknesses 
SET gap_type = 'learnable_weakness',
    current_status = 'actively developing',
    evidence = 'Built portfolio site with Next.js, TypeScript, Supabase Edge Functions. Learning by doing.'
WHERE gap_name ILIKE '%coding%' OR gap_name ILIKE '%technical%';
```

---

## 🔗 Quick Links

- **Live Site:** [Vercel deployment URL]
- **GitHub Repo:** github.com/keeganmoody33/keegan-portfolio
- **Supabase Dashboard:** supabase.com/dashboard/project/cvkcwvmlnghwwvdqudod
- **Mixmax Files:** `/home/ubuntu/upload/mixmax_data/`

---

## ✅ Completed

- [x] JD Analyzer component created and deployed
- [x] AI Chat working with Claude
- [x] Database schema set up
- [x] Git workflow configured (GitHub → Vercel auto-deploy)
- [x] Edge Functions deployed (chat, jd-analyzer)
