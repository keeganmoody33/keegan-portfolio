# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## For Claude Code: Critical Context

**This is NOT a software development repository.** This is a GTM (Go-To-Market) campaign execution workspace.

### Repository Type
- **No code compilation, builds, or tests**
- **Primary artifacts:** Markdown documentation, CSV data exports, campaign tracking
- **Core workflow:** Data analysis → campaign planning → documentation → decision tracking

### Current Repository State
The repository contains:
- **01_Executive_Dashboard/**: Weekly/bi-weekly performance tracking and strategic planning
- **02_GTM_Framework/**: Campaign methodologies and workflows
- **03_Active_Campaigns/**: Active campaign execution (currently Round 1)
- **04_Brand_Context/**: Mixmax brand assets and messaging
- **_OLD_REPO_BACKUP_2025_10_15/**: Historical archive (reference only, do not modify)

### Common Tasks You'll Help With
1. **Campaign performance analysis** - Parse CSV exports, calculate metrics, identify kill/scale decisions
2. **Documentation updates** - Update tracking tables, dashboards, decision logs
3. **Campaign planning** - Draft segment definitions, angle hypotheses, messaging frameworks
4. **Data synthesis** - Extract insights from multiple CSV sources, identify patterns
5. **Executive reporting** - Generate concise summaries for CEO + VP Revenue

### Key Files to Reference Frequently
- `CLAUDE.md` (this file) - Complete strategy context
- `01_Executive_Dashboard/TRACKING_GUIDE.md` - How metrics are calculated
- `01_Executive_Dashboard/CAMPAIGN_TRACKING_TABLE.md` - Live campaign status
- `02_GTM_Framework/Campaign_Framework.md` - Campaign structure and methodology
- `03_Active_Campaigns/Round_1_November_2025/ROUND_1_STRATEGY.md` - Current campaign details

### Working with MCP Servers
Two MCP servers are configured (see `.mcp.json`):
- **sec-edgar**: SEC filing data (for prospect research, not actively used currently)
- **notion**: Mixmax internal Notion workspace (pull additional context as needed)

### Writing Style Requirements
- **Executive-ready:** All documentation must be clear enough for CEO/VP Revenue to read
- **Concise:** Favor bullet points, tables, and scannable formats
- **Data-driven:** Always include numbers, percentages, and clear benchmarks
- **Decision-focused:** Highlight actionable insights and clear next steps
- **No jargon:** Explain GTM terms when first used

---

# Mixmax GTM Engineering Workspace

## Role & Stakeholders
**Keegan Moody** - Founding GTM Engineer
**Stakeholders:** CEO + VP Revenue (full executive visibility required)

## Mission
Generate **$300,000 in revenue** by January 15, 2026

## Constraints & Reality

### Current Resources
- **33 inboxes** via ScaledMail (domains + infrastructure)
- **15 emails max per inbox per day** (deliverability-first approach)
- **495 emails/day capacity** (33 × 15)
- **51 business days available** (Nov 1 → Jan 15, accounting for holidays)
- **25,245 total email capacity** (495 × 51 business days)
- **Scalable:** Can add more inboxes every 30-60 days (rotating strategy)

### Campaign Structure (Round-Based)
- **5 parallel campaigns per round** (different segment + angle combinations)
- **400 contacts per campaign** (2,000 total contacts per round)
- **3-email sequence** over 8-day cadence
- **6,000 emails per round** (400 × 3 × 5)
- **~12 days to send** (6,000 ÷ 495 emails/day)
- **14-15 days to evaluate** (send time + reply window)

### The Math (CRITICAL UNKNOWNS)

**Goal:** $300K by Jan 15, 2026
- **30 deals** @ $10K ACV ($8K-$12K target range)

**Known:**
- 51 business days available (Nov 1, 2025 → Jan 15, 2026 = 76 calendar days minus holidays)
- ~3-4 rounds maximum (15 business days per round to execute + evaluate)
- Need 2% reply rate minimum to have any chance
- Need 3.5%+ reply rate to scale with confidence

**Unknown - Will Track Actual Performance (These Are GUESSTIMATES):**
- **Booking rate** (currently guessing 40% of positive replies)
- **Qualification rate** (currently guessing 50% of meetings)
- **Close rate** (currently guessing 20% of qualified opps)
- **Positive reply %** (currently guessing 60% of total replies)
- **Sales cycle length** (currently guessing 45-60 days)

⚠️ **All conversion rates are hypotheses until we track real data in Round 2-3**

### Reality Check
- **At 2% reply rate (baseline):** ~120 replies per round → unclear if sufficient for $300K goal
- **At 3.5% reply rate (scale threshold):** ~210 replies per round → much better odds
- **At 0.5% reply rate (kill threshold):** Campaign is catastrophically broken

**Success = Find 2-3 winning campaigns (>3.5% reply) in early rounds and scale them aggressively**

---

## Core Philosophy

### "The List IS the Message"

When you identify the right segment with the right signals (Existential Data Points), the value proposition becomes obvious. This is not optimization of generic messaging—this is hypothesis-driven targeting where the list selection encodes the entire positioning.

**Everything else is hypothesis testing:**
- Conversion rates? Unknown until tested
- Sales cycle? Unknown until tracked
- Best messaging angle? Unknown until 5 campaigns compete
- Optimal sequence cadence? Unknown until measured

**The only truths:**
1. **The list determines the message** (targeting IS positioning)
2. **Kill <0.5% reply after 14-15 days** (catastrophic failure)
3. **Scale >3.5% reply after 14-15 days** (winner found)
4. **14-15 days minimum for quality data** (send + reply window)

---

## Strategy

### 5-Campaign Parallel Testing
1. **Launch 5 campaigns simultaneously** (different segment + angle combinations)
2. **400 contacts each** (2,000 total per round)
3. **3-email sequence** over 8-day cadence
4. **Wait 14-15 days** for send completion + reply window
5. **Kill <0.5% reply** (catastrophic, not worth optimizing)
6. **Optimize 0.5-1.5% reply** (extract learnings, maybe iterate)
7. **Scale >3.5% reply** to max capacity (winner confirmed)
8. **Ruthless reallocation** (freed capacity → proven winners)

### Round-Based Timeline (51 Business Days = ~3 Rounds Max)

**Round 1 (Nov 1-15, 2025):**
- 5 campaigns × 400 contacts × 3 emails = 6,000 emails
- Evaluate after 14-15 business days (10 business days in this period)
- Expected: 2-3 kills, 1-2 winners, 0-1 yellow flags

**Round 2 (Nov 18-Dec 5):**
- Scale 1-2 winners from Round 1 (400 → 800 contacts OR repeat 400)
- Test 2-3 new segment + angle combinations
- Evaluate after 14-15 business days (13 business days in this period)

**Round 3 (Dec 6-Jan 15):**
- Max scale proven winners (28 business days remaining)
- All capacity → proven segment + angle combos
- Pipeline materializes → deals closing
- Final push to hit $300K goal

---

## Tech Stack & Workflow

### Platform Responsibilities
- **ScaledMail:** Inbox + domain provisioning (current: 33, scalable every 30-60 days)
- **SmartLead:** Campaign sending automation (enforces 15 emails/day limit)
- **Octave:** AI messaging playbook generation
- **Clay:** Data enrichment, list building, messaging merge → SmartLead export

### Campaign Build Workflow
```
1. Define segment + angle (hypothesis)
   ↓
2. Build 400-contact list in Clay (enrich with signals/EDPs)
   ↓
3. Generate messaging in Octave (3-email sequence, 8-day cadence)
   ↓
4. Merge messaging → list in Clay (personalization at scale)
   ↓
5. Export to SmartLead (campaign deployment)
   ↓
6. Monitor in SmartLead (deliverability, replies, engagement)
   ↓
7. Wait 14-15 days (send + reply window)
   ↓
8. Kill or scale decision (0.5% kill, 3.5% scale)
```

### Data Flow Diagram
```
Clay: Build list (400 contacts)
  ↓
Clay: Enrich with signals (technographics, intent, firmographics)
  ↓
Octave: Generate 3-email sequence (AI-powered messaging)
  ↓
Clay: Merge messaging → personalized list
  ↓
SmartLead: Import campaign
  ↓
SmartLead: Send over ~13 days (3 emails, 8-day cadence per contact)
  ↓
SmartLead: Track replies, deliverability, engagement
  ↓
Analyze after 14-15 days: Kill (<0.5%) or Scale (>3.5%)
```

---

## Success Metrics

### Leading Indicators (Track Weekly, Report Every Monday)

**Email Performance:**
- **Reply rate:** Target ≥3.5% (vs 2% industry baseline)
- **Positive reply rate:** Target ≥2.1% (assuming 60% of replies are positive)
- **Deliverability:** Target ≥97%
- **Bounce rate:** Target ≤2%
- **Spam complaint rate:** Target ≤0.2%

**Engagement Quality (GUESSTIMATES - Will Track Actual):**
- **Meeting booking rate:** Target ≥50% (of positive replies)
- **Meeting show rate:** Target ≥80%
- **Meeting qualification rate:** Target ≥60% (actually fit ICP)

### Lagging Indicators (Track Bi-Weekly, Report Every Other Friday)

**Pipeline Metrics:**
- **Qualified opps created:** Target 150 by Jan 15
- **Pipeline value:** Target $1.5M by Jan 15
- **Avg days per stage:** Target ≤14 days/stage

**Revenue Metrics:**
- **Deals closed:** Target 30 by Jan 15
- **Revenue closed:** Target $300K by Jan 15
- **Actual close rate:** Target ≥20% (GUESSTIMATE)
- **Actual ACV:** Target $10K+ ($8K-$12K range)

---

## Kill Switches (Campaign-Level)

### After 14-15 Days (Not "500 Sends")

**Why 14-15 days?**
- 3-email sequence over 8-day cadence = ~13 days to complete sending
- +6-7 days for replies to come in
- = 14-15 days minimum for quality data

### 🔴 AUTOMATIC KILL (After 14-15 Days)
- Reply rate **<0.5%** → Catastrophic failure, kill immediately
- Bounce rate **>5%** → Data quality issue, pause all campaigns to investigate
- Spam complaint rate **>0.5%** → Domain reputation risk, kill to protect infrastructure
- Positive reply rate **<0.3%** → Message fundamentally not resonating

**Action:** Kill campaign, document learnings, free capacity for next round

### 🟡 YELLOW FLAG (After 14-15 Days)
- Reply rate **0.5-1.5%** → Underperforming, consider:
  - Was list quality the issue? (review Clay filters)
  - Was messaging the issue? (test new angle in next round)
  - Was timing the issue? (holidays, end of quarter, etc.)
- Meeting booking rate **<30%** (if tracking)
- Meeting no-show rate **>30%** (if tracking)
- Meeting qualification rate **<40%** (if tracking)

**Action:** Don't scale, but extract learnings. Consider modified version in next round.

### 🟢 SCALE SIGNALS (After 14-15 Days)
- Reply rate **>3.5%** → Winner! This segment + angle combination works
- Positive reply rate **>2%** → Strong resonance with target audience
- Meeting booking rate **>50%** (if tracking)
- Meeting qualification rate **>60%** (if tracking)

**Action:** Scale this campaign in next round
- Increase list size (400 → 800 contacts)
- Or keep at 400 and repeat multiple times
- Priority allocation of inbox capacity
- Document what made this campaign successful

---

## Repository Purpose

This is an **executive-visible workspace** designed for:

1. **Strategic documentation** - 90-day plan, revenue math, GTM frameworks
2. **Performance tracking** - Weekly/bi-weekly dashboards for CEO + VP Revenue
3. **Campaign execution** - 5 parallel campaign workspaces per round
4. **Decision logging** - Kill/scale decisions with clear rationale

**All documents must be executive-ready.** CEO and VP Revenue can read any file at any time and immediately understand the strategy, current progress, and decisions being made.

---

## How to Use This Repo

### For CEO/VP Revenue (Stakeholder View):
1. **Start here:** [01_Executive_Dashboard/90_Day_Plan.md](01_Executive_Dashboard/90_Day_Plan.md) - Understand goal & strategy
2. **Weekly check:** [01_Executive_Dashboard/Weekly_Performance.md](01_Executive_Dashboard/Weekly_Performance.md) - Leading indicators
3. **Bi-weekly review:** [01_Executive_Dashboard/Biweekly_Executive_Summary.md](01_Executive_Dashboard/Biweekly_Executive_Summary.md) - Pipeline & revenue
4. **Decision log:** [01_Executive_Dashboard/Campaign_Kill_Scale_Log.md](01_Executive_Dashboard/Campaign_Kill_Scale_Log.md) - Why campaigns live or die

### For GTM Engineer (Execution View):
1. **Reference frameworks:** [02_GTM_Framework/](02_GTM_Framework/) when building campaigns
2. **Daily work:** [03_Active_Campaigns/Round_2_November_2025/](03_Active_Campaigns/Round_2_November_2025/) for execution
3. **Update dashboards:** [01_Executive_Dashboard/](01_Executive_Dashboard/) weekly/bi-weekly
4. **Pull brand context:** [04_Brand_Context/](04_Brand_Context/) as needed for messaging

### For Claude Code (AI Assistant View):
1. **ALWAYS** read CLAUDE.md first to understand full context
2. Focus on campaign execution workflows:
   - Building lists in Clay
   - Writing copy with Octave context
   - Analyzing performance data
   - Identifying kill/scale decisions
3. Keep all documentation executive-ready (CEO/VP can read anytime)
4. **NEVER** document platform how-tos (use vendor docs for ScaledMail, SmartLead, Octave, Clay)
5. Flag unknowns clearly (conversion rates, sales cycle, etc.)

---

## Critical Dates

- **October 21-31, 2025:** Campaign planning & list building (pre-launch prep)
- **November 1, 2025:** Round 1 campaign sending starts (inboxes fully warm)
- **November 10, 2025:** Domain transition (mixmax.com → mixmax.ai)
- **November 15, 2025:** First kill/scale decision (14-15 days of data)
- **November 18, 2025:** Round 2 launch (winners scaled, new tests added)
- **January 15, 2026:** Revenue goal deadline ($300K)

---

## GTM Frameworks (Methodologies)

### Cannonball GTM (Jordan Crawford & Doug Bell)
- **PVP (Permissionless Value Proposition):** Value so obvious, no explanation needed
- **EDP (Existential Data Point):** Signal that proves urgent need/pain
- **FIND Process:** Focus → Investigate → Narrate → Deploy
- **Data Trinity Test:** 3 independent data sources validate the segment
- **Pain-Based Segmentation:** Group by shared pain, not demographics

### Message-Market-Fit (Kellen Casebeer)
- **Market → Segment → Persona → Angle:** Targeting hierarchy
- **Single Issue Voter:** One pain point dominates the buying decision
- **5 Simultaneous Campaigns:** Test angles in parallel, kill losers fast
- **Asymmetrical Results:** Look for 10x winners, not 10% improvements
- **100-Send Threshold:** Minimum data to make kill/scale decision (we use 14-15 days)

### Unified Approach (How We Execute)
1. Define segment with EDPs (Cannonball methodology)
2. Test 5 angles simultaneously (Message-Market-Fit methodology)
3. Kill <0.5% reply after 14-15 days (ruthless elimination)
4. Scale >3.5% reply to max capacity (aggressive winner scaling)
5. Document learnings, build repeatable playbook

---

## Reporting Cadence

### Weekly (Every Monday @ 9am PT)
**Audience:** CEO + VP Revenue + GTM Engineer
**Format:** Slack update + update `Weekly_Performance.md`
**Content:**
- Leading indicators vs targets (reply rate, deliverability, booking rate)
- Top 3 campaign performance (by reply rate)
- Kill/scale decisions made last week
- Blockers & next steps

### Bi-Weekly (Every Other Friday @ 4pm PT)
**Audience:** CEO + VP Revenue + GTM Engineer
**Format:** Update `Biweekly_Executive_Summary.md` + 15min call
**Content:**
- Lagging indicators vs targets (pipeline, revenue, close rate)
- Pipeline & revenue progress toward $300K goal
- Trajectory forecast (will we hit $300K by Jan 15?)
- Strategic adjustments needed (more inboxes? different segments?)

---

## What This Repo Is NOT

- ❌ **Not a code repository** (no software development)
- ❌ **Not a data dump** (lean, current, intentional content only)
- ❌ **Not a platform how-to guide** (use vendor docs for ScaledMail, SmartLead, Octave, Clay)
- ❌ **Not a historical archive** (active work only, extract learnings and move on)
- ❌ **Not a research library** (pull from Notion as needed, don't pre-populate)

This is an **execution workspace** with **executive visibility**. Every file serves a clear purpose in the 90-day sprint to $300K.

---

## File Naming Conventions

- **Campaign rounds:** `Round_N_Month_Year/` (e.g., Round_2_November_2025)
- **Date exports:** `YYYY-MM-DD_source_description.csv`
- **Templates:** `TEMPLATE_use_case.md`
- **Frameworks:** `Framework_Name.md` (clean, readable, no Notion IDs)
- **Campaign names:** `Campaign_X_Segment_Angle/` (e.g., Campaign_A_SaaS_Security)

---

---

## Quick Reference: Common Workflows

### Analyzing Campaign Performance
1. Locate CSV export in `03_Active_Campaigns/Round_X_Month_Year/Campaign_Y/data/`
2. Calculate key metrics (reply rate, positive reply rate, bounce rate)
3. Compare against benchmarks (0.5% kill, 3.5% scale)
4. Update `01_Executive_Dashboard/CAMPAIGN_TRACKING_TABLE.md`
5. Log decision in `01_Executive_Dashboard/Campaign_Kill_Scale_Log.md`

### Updating Weekly Dashboard
1. Review all active campaigns in `03_Active_Campaigns/`
2. Pull latest metrics from SmartLead/Clay exports
3. Update `01_Executive_Dashboard/Weekly_Performance.md`
4. Flag any campaigns hitting kill/scale thresholds
5. Summarize top 3 learnings + blockers

### Planning New Campaign Round
1. Review prior round learnings in `Campaign_Kill_Scale_Log.md`
2. Reference frameworks in `02_GTM_Framework/`
3. Draft 5 segment + angle combinations
4. Create campaign folders in `03_Active_Campaigns/Round_X_Month_Year/`
5. Document strategy in `ROUND_X_STRATEGY.md`

### Working with CSV Data
- **SmartLead exports** contain: email, reply status, bounce status, send timestamps
- **Clay exports** contain: enriched contact data, technographics, firmographics
- **Always preserve original CSVs** - create `_processed/` subfolder for transformed data
- **Use descriptive filenames** - `YYYY-MM-DD_source_description.csv`

### Git Workflow (When Needed)
```bash
# Check current status
git status

# Stage specific documentation updates
git add 01_Executive_Dashboard/Weekly_Performance.md
git add 01_Executive_Dashboard/CAMPAIGN_TRACKING_TABLE.md

# Commit with clear message (Claude will help format)
git commit -m "Update Week X performance tracking"

# Push changes (only if requested by user)
git push
```

### Important: What NOT to Do
- ❌ Don't modify files in `_OLD_REPO_BACKUP_2025_10_15/`
- ❌ Don't create platform how-to guides (use vendor docs)
- ❌ Don't pre-populate research from Notion (pull as needed)
- ❌ Don't commit without explicit user request
- ❌ Don't use git push unless explicitly asked

---

**Repository Created:** October 15, 2025
**Last Updated:** October 21, 2025
**Maintained By:** Keegan Moody (Founding GTM Engineer)
**Version:** 1.1 (Enhanced for Claude Code)
