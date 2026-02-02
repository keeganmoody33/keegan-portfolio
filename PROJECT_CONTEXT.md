# Keegan Portfolio — Complete Project Context

**Last Updated:** 2026-01-21
**Purpose:** Single source of truth for the AI-queryable portfolio project

---

## WHAT THIS PROJECT IS

An AI-queryable portfolio site at **lecturesfrom.com** where recruiters can:
1. Chat with an AI that gives honest fit assessments
2. Paste job descriptions for automated fit analysis
3. See career history and skills with real evidence

**Core Principle:** Honest over polished. The AI should recommend against hiring Keegan when the fit is bad.

---

## ARCHITECTURE (Nate B Jones Framework)

### Database Structure (Supabase)

| Table | Purpose |
|-------|---------|
| `candidate_profile` | Basic info, headline, summary |
| `experiences` | Career history with public bullets + private context |
| `skills` | Categorized as strong/moderate/gap with evidence |
| `gaps_weaknesses` | Explicit limitations and anti-patterns |
| `values_culture` | Must-haves, dealbreakers, work style |
| `ai_instructions` | **Multi-row** instructions by type |
| `faq_responses` | Pre-written answers to common questions |

### ai_instructions Types (Multi-Row)

| Type | Purpose |
|------|---------|
| `honesty` | Rules about being direct, recommending against |
| `tone` | Voice guidelines (direct, warm, self-aware) |
| `brevity` | 2-3 sentences max unless asked |
| `boundaries` | What not to share (salary, etc.) |
| `banned_phrase` | Things the AI should never say |
| `rejection_phrase` | How to decline gracefully |
| `critical_distinction` | Facts that must be stated correctly |

### Edge Functions

| Function | Purpose |
|----------|---------|
| `chat` | Main conversation endpoint |
| `jd-analyzer` | Job description fit analysis |

Both query `ai_instructions` by type and build dynamic system prompts.

---

## KEEGAN'S PROFILE SUMMARY

### Current Position
- **Title:** Product Builder / GTM Engineer
- **Target:** Product Engineer, Founding Engineer (0-to-1), GTM Engineer, Technical PM
- **Stage:** Seed to Series B
- **Location:** Atlanta area, remote preference

### The Elevator Pitch
> "I'm a product builder with a science background — biochemistry degree, 120 days of mercury research in South America, EPA-published papers. I ship full-stack web apps, AI-native products, and I'm currently building a DAW plugin in C++. I came up through GTM engineering, which means I understand both the product and the market. I learn by taking things apart."

### Career Arc
1. **Science Foundation** — Biochemistry, 120 days fieldwork, EPA-published papers
2. **The Pivot** — Teaching, COVID, Barbour Orthopedics (discovered fraud, reported it)
3. **Startup Entry** — Biofourmis SDR (sourced Orlando Health deal, fired for low activity)
4. **TraceAir** — Record month (20 demos), fired for standing up for team
5. **GTM Engineering** — Clay Cohort 11, building own products
6. **Mixmax** — Founding GTM Engineer, built infrastructure, didn't ship fast enough

### Projects Built

| Project | Stack | Status |
|---------|-------|--------|
| **Scuttlewutt** | Next.js, TypeScript, PostgreSQL, Claude + GPT-4 | Functional |
| **demonstr8** | Next.js, Supabase, Mux, Stripe | Functional |
| **lecturesfrom.com** | Supabase, Edge Functions, React, Claude | Deployed |
| **punch2pen** | C++, JUCE, Whisper | In development |

### Skills

**Strong:**
- Next.js / React / TypeScript
- Supabase, PostgreSQL
- Multi-provider LLM architecture
- Cold email strategy, Clay, Smartlead
- GTM infrastructure from scratch
- Research methodology

**Actively Developing:**
- C++ / JUCE (audio plugins)
- CMake / build systems

**Moderate:**
- API integrations
- Revenue operations
- Managing up

**Gaps:**
- Whiteboard algorithms
- Distributed systems
- Enterprise sales closing
- Managing large teams

### Gaps & Weaknesses (Honest)

1. **Finishing** — Multiple projects in various states
2. **Concise verbal communication** — Goes long when riffing
3. **Political navigation** — Fired twice as top performer
4. **Traditional CS foundations** — Won't pass whiteboard interviews

### Work Environment

**Thrives In:**
- Autonomy with guardrails
- Engaged leadership with bandwidth
- Clear deadlines
- Outcome-based metrics
- Path toward product

**Struggles In:**
- Activity metrics ("80 calls/day")
- Full autonomy with no check-ins
- Micromanagement
- Solo operator roles
- Absent leadership

---

## AI BEHAVIOR RULES

### Core Principles
1. Never oversell
2. If JD asks for X and Keegan doesn't have it, say so directly
3. Use "I'm probably not your person" when appropriate
4. Don't hedge — be direct
5. It's okay to recommend they not hire him
6. Be honest about gaps before strengths

### Response Style
- **Length:** 2-3 sentences max unless asked for detail
- **Tone:** Direct, warm, self-aware
- **Voice:** Like talking to a friend, not a recruiter

### Critical Distinctions (Must Get Right)
1. **Orlando Health deal:** Keegan SOURCED it. He did NOT close it.
2. **Terminations:** Fired twice as top performer — optics/politics, not performance
3. **Mixmax:** Didn't deliver. Built frameworks instead of shipping. Not politics.
4. **Sourcing vs Closing:** Expert at originating deals (SDR). Not experienced closer (AE).

### Boundaries
- NEVER provide salary numbers
- Response: "I don't publish compensation expectations. Open to discussing based on scope."

### When to Recommend Against
- Pure software engineering requiring CS fundamentals
- Enterprise AE closing role
- Paid acquisition / performance marketing
- Whiteboard algorithm interviews required
- Deep distributed systems architecture

---

## CURRENT STATE

### What's Done
- ✅ Multi-row `ai_instructions` table (19 rows)
- ✅ Edge Functions updated to query by instruction_type
- ✅ High-Vis UI deployed (dark theme, neon lime/orange accents)
- ✅ Timeline component pulling from Supabase
- ✅ Chat and JD Analyzer with new styling

### What Needs Attention
- [ ] Verify `experiences` table has all 7+ roles with private context
- [ ] Update `skills` table with strong/moderate/gap categories
- [ ] Update coding gap to "actively developing"
- [ ] Test AI responses for brevity and tone
- [ ] Add Mixmax experience data

---

## KEY FILES

| File | Purpose |
|------|---------|
| `LECTURESFROM_PORTFOLIO_CONTENT.md` | Master content document |
| `values-and-preferences.md` | Work style, environment preferences |
| `DATABASE_UPDATES.md` | SQL commands and update tracking |
| `TODO.md` | Active task list |
| `PROJECT_CONTEXT.md` | This file — project summary |

---

## VOICE EXAMPLES

Actual phrases Keegan uses:
- "I was rebuilding the engine when they needed me to drive the car."
- "Ship first, buzzer-beater second."
- "That's on me."
- "I learn by taking things apart."
- "I want to be in the room where the thing gets built, not just where it gets sold."

---

**END OF CONTEXT**
