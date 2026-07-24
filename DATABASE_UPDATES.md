# Database Updates

> Living document for tracking portfolio database changes, AI behavior, and artifact references.
> Obsidian-compatible with `[[backlinks]]` for cross-referencing.

---

**Last Updated:** 2026-07-24
**Status:** Active
**Supabase Project:** `cvkcwvmlnghwwvdqudod`

---

## Quick Links

- [[TODO]] — Master task list
- [[MIXMAX_narrative_brief]] — Mixmax executive summary
- [[October_2025_GTM_Monthly_Report]] — Infrastructure build month
- GitHub: [keeganmoody33/keegan-portfolio](https://github.com/keeganmoody33/keegan-portfolio)
- Supabase: [Dashboard](https://supabase.com/dashboard/project/cvkcwvmlnghwwvdqudod)

---

## 1. AI Tone

### Current State

- **Problem:** Responses too long, sometimes roast-y
- **Goal:** 2-3 sentences max, matter-of-fact honest, calm

### Target Behavior

| Attribute | Before | After |
|-----------|--------|-------|
| Length | Paragraphs | 2-3 sentences |
| Tone | Roast-y, harsh | Matter-of-fact, calm |
| Style | Marketing-speak | Like talking to a friend |
| On gaps | Dramatic | State plainly, no drama |
| On strengths | Bragging | Let work speak |
| On bad fit | Soft | Direct: "This probably isn't a fit because..." |

### SQL Update

```sql
UPDATE ai_instructions 
SET content = 'You are Keegan''s portfolio AI. Be direct and brief.

RESPONSE LENGTH: 2-3 sentences max unless asked for detail.
TONE: Matter-of-fact, not roast-y. Honest without being harsh.
STYLE: Like talking to a friend, not a recruiter.

When discussing gaps: State them plainly. No drama.
When discussing strengths: Let the work speak. No bragging.
When fit is bad: Say so directly. "This probably isn''t a fit because..."

You have access to Keegan''s real work history, skills, and honest assessments of gaps.',
    updated_at = NOW()
WHERE instruction_type = 'system_prompt';
```

### Suggested Chat Questions (Replace Current)

- "What are you working on right now?"
- "What's your background?"
- "What kind of roles are you looking for?"
- "Tell me about the Mixmax project"
- "What are your actual skill gaps?"

### Status

- [ ] SQL executed in Supabase
- [ ] Tested in production
- [ ] Questions updated in UI

---

## 2. Mixmax Data

### Role Summary

| Field | Value |
|-------|-------|
| Company | Mixmax |
| Role | Founding GTM Engineer |
| Dates | Aug 2025 – Dec 2025 |
| Duration | 5 months |

### Key Accomplishments

1. **Built GTM infrastructure from zero** — 53 inboxes, multi-provider strategy
2. **Validated ICP** — 280 customers, $4.79M ARR analyzed
3. **Created "The Volley Method"** — Dual-source validation (quant + qual)
4. **Debunked ghost statistics** — Killed the "26%" claim with audit trail
5. **Built 9-agent AI system** — Gutenberg Framework for outbound
6. **Packaged for handoff** — CRO memo, onboarding guide, portable methodology

### Validated Statistics (from [[CORRECTED_STATISTICS_QUICK_REFERENCE]])

| Stat | Value | Source |
|------|-------|--------|
| Customers analyzed | 280 | Salesforce + Clay enrichment |
| Total ARR mapped | $4.79M | Validated dataset |
| Optimal target band | 51-200 employees | 32.9% of accounts, $12,674 avg ARR |
| Case studies classified | 43 | KEEP/CAVEAT/DEMOTE tiers |
| Revenue concentration | 15% of accounts = 66% of revenue | Power law distribution |

### Key Files (The Essential 5)

| File | Purpose | Link |
|------|---------|------|
| [[October_2025_GTM_Monthly_Report]] | Shows the build | Infrastructure month |
| [[CRO_PACKAGE_COVER]] | Executive packaging | 3-min summary |
| [[CORRECTED_STATISTICS_QUICK_REFERENCE]] | Validated claims | Receipts |
| [[GTM_ONBOARDING]] | Portability | Next-person handoff |
| [[CLAUDE]] | AI agent system | 9 specialists |

### Honest Context
>
> Short engagement (5 months). Built systems and methodology but didn't stay to see full execution results. The work is solid and documented, but I can't claim revenue outcomes from campaigns I didn't run.

### SQL Update

```sql
INSERT INTO experiences (company, role, start_date, end_date, description, honest_context)
VALUES (
  'Mixmax',
  'Founding GTM Engineer',
  '2025-08-01',
  '2025-12-31',
  'Built GTM infrastructure from zero: 53 inboxes, integrated tech stack (Clay → Octave → SmartLead → HeyReach). Validated ICP across 280 customers ($4.79M ARR). Created "The Volley Method" for dual-source validation. Debunked ghost statistics with audit trails. Built 9-agent AI system (Gutenberg Framework). Packaged methodology for handoff.',
  'Short engagement (5 months). Built systems and methodology but didn''t stay to see full execution results. The work is solid and documented, but I can''t claim revenue outcomes from campaigns I didn''t run.'
);
```

### Status

- [ ] SQL executed in Supabase
- [ ] Files uploaded to repo
- [ ] AI can reference Mixmax work

---

## 3. Skill Gaps

### Current Gaps (Update Needed)

| Gap | Previous Status | New Status | Evidence |
|-----|-----------------|------------|----------|
| Coding | Hard limitation | Actively developing | Built this portfolio with Next.js, TypeScript, Supabase |
| Product sense | Gap | Emerging strength | GTM Intelligence System shows product thinking |
| Closing deals | Acknowledged | Still a gap | Sourcing/originating strong, closing weak |

### Skills to Add

| Skill | Proficiency | Evidence |
|-------|-------------|----------|
| TypeScript | Beginner → Intermediate | Portfolio site, Edge Functions |
| React/Next.js | Beginner | Portfolio site |
| Supabase/PostgreSQL | Beginner | Database design, Edge Functions |
| API integration | Intermediate | Claude API, Firecrawl integration |
| System design | Intermediate | Mixmax GTM Intelligence System |
| Clay / outbound infrastructure | Intermediate | AssetMule, BCOFA, Kivira — list building, sequencing, inbox provisioning |
| Knowledge graph / Context OS | Intermediate | Kivira Context OS with linked nodes, wiki-links, graph indexing |
| React + Vite + TypeScript + Leaflet | Beginner → Intermediate | Morph MSO Intelligence Platform |
| Healthcare GTM / compliance messaging | Intermediate | Kivira CDS framing, BCOFA HIPAA/CAN-SPAM aware outreach |
| MSO market intelligence / PE signal research | Intermediate | Morph Focus HCS research — NPI/TIN, SOS, Form D, CRE signals |
| Intern onboarding / delegation | Beginner → Intermediate | Kivira — onboarded and ramped NYU interns on GTM work |

### SQL Updates

```sql
-- Update coding gap
UPDATE gaps_weaknesses 
SET gap_type = 'learnable_weakness',
    current_status = 'actively developing',
    evidence = 'Built portfolio site with Next.js, TypeScript, Supabase Edge Functions. Learning by doing.',
    updated_at = NOW()
WHERE gap_name ILIKE '%coding%' OR gap_name ILIKE '%technical%';

-- Add new skills
INSERT INTO skills (skill_name, category, proficiency, evidence)
VALUES 
  ('TypeScript', 'Programming', 'beginner', 'Portfolio site, Edge Functions'),
  ('React/Next.js', 'Frontend', 'beginner', 'Portfolio site'),
  ('Supabase', 'Backend', 'beginner', 'Database design, Edge Functions'),
  ('API Integration', 'Backend', 'intermediate', 'Claude API, Firecrawl'),
  ('System Design', 'Architecture', 'intermediate', 'Mixmax GTM Intelligence System'),
  ('Clay / Outbound Infrastructure', 'GTM Engineering', 'intermediate', 'AssetMule, BCOFA, Kivira — list building, sequencing, inbox provisioning'),
  ('Knowledge Graph / Context OS', 'GTM Engineering', 'intermediate', 'Kivira Context OS with linked nodes, wiki-links, graph indexing'),
  ('React + Vite + TypeScript + Leaflet', 'Frontend', 'intermediate', 'Morph MSO Intelligence Platform'),
  ('Healthcare GTM / Compliance Messaging', 'GTM Engineering', 'intermediate', 'Kivira CDS framing, BCOFA HIPAA/CAN-SPAM aware outreach'),
  ('MSO Market Intelligence / PE Signal Research', 'GTM Engineering', 'intermediate', 'Morph Focus HCS research — NPI/TIN, SOS, Form D, CRE signals'),
  ('Intern Onboarding / Delegation', 'Operations', 'intermediate', 'Kivira — onboarded and ramped NYU interns on GTM work');
```

### Status

- [ ] SQL executed in Supabase
- [ ] AI reflects updated gaps

---

## 4. Artifact Library

### Apps & Projects

| Project | Type | Tech Stack | Status | Links |
|---------|------|------------|--------|-------|
| Portfolio Site | Web App | Next.js, TypeScript, Supabase, Vercel | Active | [[keegan-portfolio]], [GitHub](https://github.com/keeganmoody33/keegan-portfolio) |
| JD Analyzer | Feature | Edge Functions, Claude API, Firecrawl | Active | Part of portfolio |
| Discogs Feature | Feature | TBD | Planned | Rabbit hole project |
| BCOFA GTME | Outbound GTM system | Python scrapers, NPI API, Clay, LinkedIn | Active (advising) | `BCOFA | GTME/` |
| Kivira Context OS | Knowledge graph / GTM OS | Markdown wiki-links, Python scripts, Clay, SendKit | Active (contract ended) | `KIVIRA.HEALTH/` |
| Morph MSO Intelligence Platform | Data viz / research app | React, Vite, TypeScript, Leaflet | Pushed to GitHub | [mso-intelligence-platform](https://github.com/keeganmoody33/mso-intelligence-platform.git) |
| AssetMule Outreach | Outbound motion | Clay email sequencer | Brief contract | `experiences/09-assetmule.md` |

### Mixmax Artifacts

| Artifact | Type | Purpose | Link |
|----------|------|---------|------|
| GTM Intelligence System | Methodology | ICP validation framework | [[GTM_INTELLIGENCE_SYSTEM]] |
| Gutenberg Framework | System | 9-agent outbound automation | [[CLAUDE]] |
| CRO Package | Deliverable | Executive summary | [[CRO_PACKAGE_COVER]] |
| Onboarding Guide | Documentation | Handoff for next GTM engineer | [[GTM_ONBOARDING]] |

### Tutorials & Looms

| Title | Type | Topic | Link |
|-------|------|-------|------|
| TBD | Loom | TBD | — |

### Technologies Used

| Technology | Used For | Rationale | Status |
|------------|----------|-----------|--------|
| Next.js | Portfolio frontend | React-based, good DX, Vercel integration | ✅ Using |
| Supabase | Database + Auth + Edge Functions | PostgreSQL, generous free tier, Edge Functions | ✅ Using |
| Vercel | Hosting | Auto-deploy from GitHub, free tier | ✅ Using |
| Claude API | AI chat + JD analysis | Best reasoning, honest responses | ✅ Using |
| Firecrawl | URL scraping | Clean API for job posting extraction | ✅ Using |
| Clay | Data enrichment | Best for B2B prospecting | ✅ Advocating |
| Apollo.io | Data sourcing | Inconsistent quality, vendor lock-in | ❌ Rejected |

---

## 5. Workflow

### Update Process

1. Make changes in this file
2. Run SQL in Supabase SQL Editor
3. Test in production
4. Mark status checkboxes complete
5. Commit to GitHub

### File Locations

```
keegan-portfolio/
├── DATABASE_UPDATES.md    ← This file
├── TODO.md                ← Task tracking
├── portfolio-site/        ← Next.js app
│   ├── app/
│   ├── components/
│   └── lib/
└── supabase/
    └── functions/         ← Edge Functions
```

### Supabase Tables

| Table | Purpose |
|-------|---------|
| `candidate_profiles` | Basic profile info |
| `experiences` | Work history with honest context |
| `skills` | Skills matrix with proficiency |
| `achievements` | Quantified accomplishments |
| `ai_instructions` | System prompts, personality |
| `gaps_weaknesses` | Hard limitations, learnable gaps |

---

## 6. Recent Experience Additions (July 2026)

Four new work experiences added to `experiences/` in this update.

### AssetMule

**Role:** GTM Contractor — Outbound Operations  
**Duration:** July 2025 (brief contract)  
**File:** `experiences/09-assetmule.md`  
**Key points:** Clay email sequencer, list building, worked with Jorge Macias (now GTM-Engineering.io), referral/affiliate offer structure.

### Bariatric Centers of America (BCOFA)

**Role:** Sales Consultant → GTM Engineer Consultant  
**Duration:** Jan–Jun 2024; 2025–2026  
**File:** `experiences/10-bcofa.md`  
**Key points:** Bariatric/medical weight loss/HRT/lifestyle clinic GTM, Python scraping pipeline, inbox provisioning, $200K+ early-stage pipeline, 20+ net-new leads.

### Kivira.health

**Role:** GTM Engineering / Outbound Operations  
**Duration:** Apr–Jun 2026  
**File:** `experiences/11-kivira.md`  
**Key points:** 15 inboxes, cold outbound, campaigns, cold calls, NYU intern onboarding, Context OS / knowledge graph, primary care mental-health wedge.

### Morph Data Strategies / Focus HCS

**Role:** Outside Creative Researcher — MSO Intelligence Engine  
**Duration:** ~May 2026  
**File:** `experiences/12-morph-data-strategies.md`  
**Key points:** MSO market research, six angle dossiers, interactive HTML figures, full publication, working React/Vite/TS/Leaflet platform. Publication had review issues and no confirmed client handoff.

### SQL Update

```sql
-- AssetMule
INSERT INTO experiences (company, role, start_date, end_date, description, honest_context)
VALUES (
  'AssetMule',
  'GTM Contractor — Outbound Operations',
  '2025-07-01',
  '2025-07-31',
  'Supported early GTM execution for AssetMule via SoundGTM. Built Clay lists targeting product marketers at startups up to 100 employees, launched outbound email campaigns using Clay email sequencer, and worked with Jorge Macias on campaign setup.',
  'Short, unpaid freelance engagement. Referral/affiliate compensation structure. No verified revenue or reply-rate metrics.'
);

-- BCOFA
INSERT INTO experiences (company, role, start_date, end_date, description, honest_context)
VALUES (
  'Bariatric Centers of America',
  'GTM Engineer Consultant',
  '2025-03-01',
  '2025-04-30',
  'Built outbound GTM engine for BariTotalCare across bariatric surgery, medical weight loss, HRT, and lifestyle medicine clinics. Provisioned inboxes, configured cold email, built Python scraping and enrichment pipelines, designed LinkedIn and parallel list-building workflows.',
  'Short advising/execution engagement. Heavy on strategy and enablement. $200K+ early-stage pipeline, 20+ net-new leads — founder-assisted, not closed revenue.'
);

-- Kivira
INSERT INTO experiences (company, role, start_date, end_date, description, honest_context)
VALUES (
  'Kivira.health',
  'GTM Engineering / Outbound Operations',
  '2026-04-01',
  '2026-06-30',
  'Led cold outbound execution for Kivira mental-health clinical decision support platform. Provisioned 15 inboxes, built lists, sent campaigns, made cold calls, onboarded NYU interns, and built the Kivira Context OS knowledge graph for GTM memory.',
  'Three-month contract. Outbound execution + knowledge-system build. No verified closed-revenue numbers from campaigns.'
);

-- Morph Data Strategies / Focus HCS
INSERT INTO experiences (company, role, start_date, end_date, description, honest_context)
VALUES (
  'Morph Data Strategies (Focus HCS)',
  'Outside Creative Researcher — MSO Intelligence Engine',
  '2026-05-01',
  '2026-05-31',
  'Built MSO Intelligence Engine for Focus HCS client: market research, six angle dossiers, interactive HTML figures, full publication, and a working React/Vite/TypeScript/Leaflet platform.',
  'Research contract. Publication received "needs changes" review and was not fully cleared for handoff. Platform pushed to GitHub but no confirmed deployment or client sign-off.'
);
```

### Pending

- [ ] Source interview with Keegan on the four new experiences
- [ ] External audit of claims and evidence for BCOFA, Kivira, Morph, and AssetMule
- [ ] Sync updated experiences to Supabase
- [ ] Update `skills-matrix.md` after source interview and audit

---

## Changelog

| Date | Change | Status |
|------|--------|--------|
| 2026-07-24 | Added AssetMule, BCOFA, Kivira, Morph experiences | ⏳ Pending source interview / audit / SQL |
| 2026-07-24 | Added new skills to Skills to Add / SQL | ⏳ Pending SQL |
| 2026-07-24 | Added recent work artifacts to Artifact Library | ✅ |
| 2026-01-20 | Created DATABASE_UPDATES.md | ✅ |
| 2026-01-20 | Added AI tone updates | ⏳ Pending SQL |
| 2026-01-20 | Added Mixmax experience | ⏳ Pending SQL |
| 2026-01-20 | Added skill gap updates | ⏳ Pending SQL |
