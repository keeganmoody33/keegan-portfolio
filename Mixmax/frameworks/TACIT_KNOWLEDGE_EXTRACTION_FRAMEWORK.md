# Tacit Knowledge Extraction Framework

**A Methodology for Surfacing Implicit Knowledge from Case Studies and Translating Insights Across Verticals**

---

```
Status: Production-Ready
Version: 1.0
Created: 2025-12-03
Author: Keegan Moody
License: Open (Attribution)
```

---

## Abstract

This framework provides a systematic methodology for extracting tacit knowledge—the implicit, unstated, "everyone knows" information—from business case studies and translating those insights across completely different industries. The framework operates in three phases: (1) Identifying the Unsaid, (2) Universal Mechanism Identification, and (3) Cross-Vertical Pattern Mapping.

**Core Insight:** Case studies explicitly state results and features used, but the actual purchase decision is driven by implicit factors: cultural signals, hidden constraints, success prerequisites, and industry truisms that are so obvious to insiders they're never documented.

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [The Three-Phase Framework](#2-the-three-phase-framework)
3. [Phase 1: Identifying the Unsaid](#3-phase-1-identifying-the-unsaid)
4. [Phase 2: Universal Mechanism Identification](#4-phase-2-universal-mechanism-identification)
5. [Phase 3: Cross-Vertical Pattern Mapping](#5-phase-3-cross-vertical-pattern-mapping)
6. [Implementation: Claygent Prompts](#6-implementation-claygent-prompts)
7. [Real-World Example](#7-real-world-example)
8. [Pattern Library Template](#8-pattern-library-template)
9. [Best Practices](#9-best-practices)

---

## 1. The Problem

Traditional case study analysis captures explicit information:
- Company name, size, industry
- Features used
- Metrics achieved
- Direct quotes

**What gets missed:**
- Why did they actually buy? (Not the stated reason—the real one)
- What had to already be true for this to work?
- What would have made this fail?
- What do insiders know that outsiders don't?
- Where else does this exact pattern appear?

This framework systematically extracts those hidden insights.

---

## 2. The Three-Phase Framework

```
┌─────────────────────────────────────────────────────────────┐
│                 TACIT KNOWLEDGE EXTRACTION                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│   PHASE 1: IDENTIFYING THE UNSAID                            │
│   ┌─────────────────────────────────────────────────────┐    │
│   │  Hidden Constraints                                   │    │
│   │  Cultural Signals                                     │    │
│   │  Success Prerequisites                                │    │
│   │  Failure Conditions                                   │    │
│   │  Industry Truisms                                     │    │
│   └─────────────────────────────────────────────────────┘    │
│                          │                                    │
│                          ▼                                    │
│   PHASE 2: UNIVERSAL MECHANISM IDENTIFICATION                │
│   ┌─────────────────────────────────────────────────────┐    │
│   │  Strip industry-specific language                     │    │
│   │  Reveal structural patterns                           │    │
│   │  Identify the abstract problem being solved           │    │
│   └─────────────────────────────────────────────────────┘    │
│                          │                                    │
│                          ▼                                    │
│   PHASE 3: CROSS-VERTICAL PATTERN MAPPING                    │
│   ┌─────────────────────────────────────────────────────┐    │
│   │  Velocity Pressures                                   │    │
│   │  Coordination Complexity                              │    │
│   │  Scale Dynamics                                       │    │
│   │  Visibility Requirements                              │    │
│   │  Adoption Barriers                                    │    │
│   └─────────────────────────────────────────────────────┘    │
│                          │                                    │
│                          ▼                                    │
│   OUTPUT: Validated insights for 4+ disparate verticals      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1: Identifying the Unsaid

Examine each case study for five categories of implicit information:

### 3.1 Hidden Constraints

**What to look for:** Unstated limitations or prior failures

**Signal phrases:**
- "easy adoption" → Prior tool failed due to complexity
- "quick implementation" → Previous solution took too long
- "works with existing workflow" → Past disruption caused resistance

**Example:**
> Case says: "We needed a solution that was easy for new hires to adopt"
>
> **Hidden constraint:** They've likely had tool adoption failures before. Training time is a bottleneck. New hire onboarding is frequent (high turnover or rapid scaling).

### 3.2 Cultural Signals

**What to look for:** Language revealing organizational dynamics

**Signal phrases:**
- "feels like 2-3 extra people" → Capacity anxiety, resource constraints
- "finally have visibility" → Previous management blind spots
- "everyone uses it" → Rare cross-functional alignment achieved

**Example:**
> Quote: "It feels like we added 2-3 extra salespeople without the headcount"
>
> **Cultural signal:** Resource scarcity mindset. Headcount requests get denied. They need to do more with less. Efficiency is valued over effectiveness.

### 3.3 Success Prerequisites

**What to look for:** Factors that must pre-exist for success

**Common prerequisites:**
- Existing CRM infrastructure (Salesforce, HubSpot)
- Gmail/Google Workspace as primary email
- Leadership buy-in for process standardization
- Defined ICP and sales process clarity
- Data hygiene sufficient for personalization

**Example:**
> Case mentions: "Salesforce integration was seamless"
>
> **Prerequisite:** They already had Salesforce. They had data hygiene sufficient for sync. Someone owned the CRM configuration.

### 3.4 Failure Conditions

**What to look for:** What would have killed this initiative

**Questions to ask:**
- What if onboarding took 2 weeks instead of 2 days?
- What if it didn't integrate with their existing stack?
- What if it required manager approval for every action?
- What if the UI was complex?

**Example:**
> Fast-growing startup case study
>
> **Failure condition:** If onboarding took more than a day, new hires would skip it. If it required training, adoption would fail. If it wasn't self-service, bottleneck at manager level.

### 3.5 Industry Truisms

**What to look for:** Assumptions too obvious to state

**Examples by industry:**
- **SaaS Sales:** "SDRs turn over frequently" (never stated, always true)
- **Recruiting:** "Candidates ghost" (obvious to recruiters)
- **Real Estate:** "Timing is everything" (deals die if you're slow)
- **Healthcare:** "Compliance is non-negotiable" (implicit in every decision)

---

## 4. Phase 2: Universal Mechanism Identification

### 4.1 The Translation Process

Strip industry-specific language to reveal the underlying structure:

| Industry-Specific | Universal Mechanism |
|-------------------|---------------------|
| "Sales engagement platform for SDR scaling" | "Asynchronous coordination with uncertain response timing + template-based customization at high volume" |
| "Candidate relationship management" | "High-volume relationship nurturing with long, unpredictable conversion cycles" |
| "Patient scheduling automation" | "Time-sensitive coordination across multiple parties with compliance constraints" |

### 4.2 The Universal Pattern Template

Every business problem can be described as:

> "[Volume/velocity characteristic] + [communication type] + [timing dynamic] + [customization requirement] + [visibility need]"

**Examples:**

**Sales Engagement:**
> "High-volume + asynchronous + uncertain response timing + template-based personalization + team visibility"

**Healthcare Scheduling:**
> "High-volume + asynchronous + time-sensitive + compliance-constrained + multi-party coordination"

**University Admissions:**
> "Seasonal surge + relationship-based + long cycle + personalized + tracking-dependent"

### 4.3 Validation Questions

After identifying the universal mechanism, test it:

1. Does this description make sense to someone outside the industry?
2. Can you think of 3 other contexts where this exact description applies?
3. Did you remove all industry jargon?
4. Would the original customer recognize their problem in this description?

---

## 5. Phase 3: Cross-Vertical Pattern Mapping

### 5.1 The Five Transferability Dimensions

Analyze the universal mechanism across these dimensions:

| Dimension | Description | Scale |
|-----------|-------------|-------|
| **Velocity Pressures** | Time-to-value, iteration speed, response expectations | Low → High |
| **Coordination Complexity** | Stakeholder count, async needs, cross-functional dependencies | Simple → Complex |
| **Scale Dynamics** | Volume, repeatability, automation potential | Small → Massive |
| **Visibility Requirements** | Measurement needs, accountability, data-driven decisions | Optional → Critical |
| **Adoption Barriers** | Change resistance, learning curve tolerance, integration complexity | Low → High |

### 5.2 The Combination Rule

**Critical insight:** It's not single factors that transfer—it's combinations.

A pattern transfers to another vertical when **5+ of these factors co-occur:**

- High-volume interactions
- Asynchronous communication
- Time-sensitive workflows
- Template-based customization
- Relationship-based engagement
- Team scaling pressure
- Visibility/tracking requirements
- Low learning curve requirements

### 5.3 Validated Cross-Vertical Applications

| Original Vertical | Target Vertical | Shared Combination |
|-------------------|-----------------|-------------------|
| SaaS SDR Outreach | Recruiting | High-volume, async, template, relationship, scaling |
| Sales Engagement | Real Estate | Time-sensitive, high-volume, template, tracking |
| Customer Success | Healthcare | Async, high-volume, compliance, multi-party |
| Lead Nurturing | Legal Intake | Template, relationship, tracking, long-cycle |
| Pipeline Management | University Admissions | Seasonal, relationship, long-cycle, tracking |

---

## 6. Implementation: Claygent Prompts

### 6.1 Quick Analysis Prompt (15 minutes)

```
Analyze this case study:

Company: [PASTE COMPANY NAME]
Industry: [PASTE INDUSTRY]
Stated Problem: [PASTE THE NEED/CHALLENGE]
Solution: [PASTE WHAT THEY USED]
Results: [PASTE ALL METRICS]
Quote: [PASTE ANY QUOTE IF YOU HAVE ONE]

Answer these 5 questions:

1. THE UNSAID PROBLEM: Based on the language and metrics, what's the REAL problem they were solving (not just what they stated)? What pain was so obvious to insiders it didn't need full explanation?

2. SUCCESS PREREQUISITES: What 3-5 things had to already be true for this to work? What would have made this fail?

3. THE UNIVERSAL PATTERN: Strip away industry terminology. What's the fundamental coordination/workflow problem being solved in plain language?

4. FOUR DIFFERENT INDUSTRIES: Name 4 completely different industries where this exact pattern appears. For each industry, explain:
   - What the parallel use case would be
   - Why the pattern transfers

5. THE COMBINATION: What specific COMBINATION of factors makes this transferable? Pick from:
   - High-volume interactions
   - Asynchronous communication
   - Time-sensitive workflows
   - Template-based customization
   - Relationship-based
   - Team scaling pressure
   - Visibility/tracking requirements
   - Low learning curve requirements

Return as structured bullet points with clear headers for each question.
```

### 6.2 Deep Analysis Prompt (45 minutes)

```
# SYSTEM CONTEXT
You are extracting tacit knowledge from a business case study. Your task is to surface implicit information that insiders know but isn't documented, then translate the pattern across industries.

# CASE STUDY INPUT
[PASTE FULL CASE STUDY TEXT]

# INSTRUCTIONS

Return a JSON object with the following structure:

{
  "explicit_data": {
    "company": "",
    "industry": "",
    "size": "",
    "stated_problem": "",
    "solution_used": "",
    "results": [],
    "quotes": []
  },
  "tacit_knowledge": {
    "hidden_constraints": [],
    "cultural_signals": [],
    "success_prerequisites": [],
    "failure_conditions": [],
    "industry_truisms": []
  },
  "universal_mechanism": {
    "industry_specific_description": "",
    "universal_description": "",
    "core_pattern": ""
  },
  "cross_vertical_applications": [
    {
      "target_industry": "",
      "parallel_use_case": "",
      "why_it_transfers": "",
      "shared_factors": []
    }
  ],
  "confidence_levels": {
    "explicit_data": "HIGH/MEDIUM/LOW",
    "tacit_inferences": "HIGH/MEDIUM/LOW",
    "cross_vertical_validity": "HIGH/MEDIUM/LOW"
  }
}

# CRITICAL RULES
- Always label what is INFERRED vs EXPLICIT
- Never invent facts—only infer from evidence in the text
- Test each cross-vertical application against the 5-factor rule
- Include confidence levels for all inferences
```

### 6.3 Batch Processing Prompt

```
For each case study in this batch, extract:

1. Company name
2. Universal mechanism (one sentence)
3. Top 3 success prerequisites
4. Top 3 cross-vertical applications
5. Pattern combination (list of factors)

Format as CSV with these columns:
company,universal_mechanism,prerequisites,vertical_1,vertical_2,vertical_3,factors

Process efficiently—prioritize speed over exhaustive analysis.
```

---

## 7. Real-World Example

### Input: Hostfully Case Study

**Raw Data:**
- Company: Hostfully
- Industry: Property Management SaaS
- Size: 51-200 employees
- Stated Need: "Meet growing revenue targets, needed easy adoption"
- Solution: Mixmax Rules, sequences, templates
- Results: 70% open rate, 466% increase in emails per rep, 576% pipeline increase YoY
- Quote: "Easy enough for someone new to sales engagement"

### Phase 1 Output: Identifying the Unsaid

**Hidden Constraints:**
- "Easy adoption" → Prior tool failed due to complexity
- "Someone new to sales engagement" → Hiring inexperienced reps (scaling fast)

**Cultural Signals:**
- Growth-stage company anxiety
- Hiring faster than they can train
- Need predictability without extensive onboarding

**Success Prerequisites:**
- Already using Salesforce (mentioned)
- Gmail as primary email
- Leadership approved tool investment
- Defined sales process (even if informal)

**Failure Conditions:**
- Complex onboarding would kill adoption
- If it didn't integrate with Salesforce, dead on arrival
- If reps needed training, bottleneck at manager

**Industry Truisms:**
- SaaS SDRs turn over frequently
- Pipeline is the only metric that matters
- Open rates are vanity; meetings are real

### Phase 2 Output: Universal Mechanism

**Industry-Specific:**
> "Sales engagement platform for property management SaaS sales team scaling"

**Universal:**
> "Asynchronous high-volume outreach with template customization and rapid team scaling without training overhead"

**Core Pattern:**
> "Capacity multiplication through standardized automation during hypergrowth"

### Phase 3 Output: Cross-Vertical Applications

| Target Industry | Use Case | Why It Transfers |
|-----------------|----------|------------------|
| **Recruiting** | Candidate outreach at scale | High-volume, async, template, relationship, scaling pressure |
| **Real Estate** | Property tour scheduling | Time-sensitive, high-volume, template, tracking |
| **Healthcare** | Patient appointment reminders | Async, high-volume, compliance, multi-party |
| **Legal** | Client intake qualification | Template, relationship, tracking, long-cycle |
| **Education** | Admissions nurture campaigns | Seasonal, relationship, personalized, long-cycle |

**Shared Combination (5+ factors):**
- High-volume interactions ✓
- Asynchronous communication ✓
- Template-based customization ✓
- Team scaling pressure ✓
- Low learning curve requirement ✓
- Visibility/tracking requirements ✓

---

## 8. Pattern Library Template

Build a pattern library as you analyze case studies:

| Company | Industry | Universal Mechanism | Factor Combination | Vertical 1 | Vertical 2 | Vertical 3 | Vertical 4 |
|---------|----------|--------------------|--------------------|------------|------------|------------|------------|
| Hostfully | SaaS | Capacity multiplication during hypergrowth | High-vol, async, template, scaling, low-curve | Recruiting | Real Estate | Healthcare | Legal |
| Bennie | HR Tech | Team visibility across distributed outreach | Async, visibility, cross-functional, scaling | Consulting | Real Estate | Education | Financial Services |
| Veraset | Data | Compliance-constrained high-volume coordination | High-vol, compliance, template, tracking | Healthcare | Legal | Financial Services | Government |

After 5-10 case studies, meta-patterns emerge—you'll know instantly which verticals to target.

---

## 9. Best Practices

### 9.1 Start with Extreme Results

Analyze cases with dramatic outcomes first:
- 576% pipeline increase
- 100% improvement in reply rate
- 437% meeting increase

**Why:** Extreme results = strong signals = easier to extract the unsaid.

### 9.2 Hunt for Emotional Language

Quotes with emotion reveal the most:
- "Feels like 2-3 extra salespeople"
- "Wish we had started sooner"
- "Game-changer for our team"

**Why:** Emotion = pain intensity = cultural context.

### 9.3 Test Your Translations

Send your cross-vertical insights to someone in that industry:
> "Hey, does this resonate? Does your team face this exact pattern?"

If they say "YES, exactly!"—you've found a valid transfer.

### 9.4 Track Your Hit Rate

Keep a scorecard:
- How many verticals resonate (people confirm the pattern)
- How many don't
- What patterns have highest hit rate

This feedback loop improves your pattern recognition.

### 9.5 Always Label Fact vs. Inference

**Explicit:** Directly stated in the case study
**Inferred:** Derived from signals but not stated
**Speculative:** Hypothesis requiring validation

Never present inferences as facts.

---

## Glossary

| Term | Definition |
|------|------------|
| **Tacit Knowledge** | Implicit understanding that insiders have but isn't documented |
| **Universal Mechanism** | The abstract pattern underlying an industry-specific problem |
| **Hidden Constraint** | Unstated limitation that shaped the buying decision |
| **Cultural Signal** | Language that reveals organizational dynamics |
| **Success Prerequisite** | Factor that must pre-exist for a solution to work |
| **Failure Condition** | What would have killed the initiative |
| **Industry Truism** | Assumption so obvious to insiders it's never stated |
| **Cross-Vertical Transfer** | Applying insights from one industry to another |
| **Factor Combination** | The specific mix of characteristics that makes a pattern transferable |

---

## License

This framework is released for open use with attribution. If you use this methodology, credit:

> Tacit Knowledge Extraction Framework by Keegan Moody (2025)

---

**End of Framework**
