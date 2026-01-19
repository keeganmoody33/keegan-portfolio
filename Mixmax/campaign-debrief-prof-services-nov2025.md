# Campaign Debrief: Professional Services & Marketing
**November 2025**

---

## Overview

| Detail | Value |
|--------|-------|
| **Segment** | Professional Services & Marketing |
| **Total Contacts** | ~2,000 |
| **Contacts Sent** | ~1,500 |
| **Asset** | Existing messaging (no new variations) |
| **Owner** | Keegan Moody |

---

## What Happened

We ran a single-message campaign targeting professional services and marketing contacts using existing copy.

**Technical Issue:** Approximately 500 contacts (~25%) did not send due to a sync failure between Clay and SmartLeads. This was a process miss on my end — I didn't verify the full sync completed before triggering the sequence.

No A/B testing was run. No offer variations were tested. This limited the learnings we could extract from the campaign.

---

## Key Learnings

### 1. We tested outside our core ICP

Based on our ICP analysis of 297 paying customers:

| Segment | % of Customer Base | Avg ARR |
|---------|-------------------|---------|
| **Software/SaaS** | 23.6% (70 customers) | $15,892 |
| **Advertising Services** | 5.4% (16 customers) | $10,405 |
| **Marketing Services** | 1.7% (5 customers) | $24,940 |

Professional services and marketing combined represent **less than 10%** of our paying customer base. This campaign tested a segment that's adjacent to ICP — not where our best customers actually come from.

**Our bull's-eye is B2B SaaS companies with 50-200 employees, using Salesforce + Gmail.**

### 2. The TAM is massive — single campaigns won't cut it

Mixmax is a horizontal play. Our addressable market is approximately:
- ~20,000 target companies
- ~200,000 potential contacts

A 2K campaign is a 1% sample. Without testing multiple offers and message variations simultaneously, we're not learning fast enough to find message-market fit.

### 3. Infrastructure needs a QA step

The Clay → SmartLeads sync failure cost us 25% of our volume. 

**Action item:** Add a pre-launch verification step to confirm full contact sync before triggering any sequence. This becomes critical as we scale volume.

### 4. Shifting to open rates as leading indicator

We're now tracking open rates as the primary signal for deliverability health. Reply rates matter, but if emails aren't landing in primary inbox, reply data is meaningless.

Deliverability is the foundation — we measure that first.

---

## What This Means Going Forward

This campaign confirmed we need to shift strategy.

**Old approach:** Test one message against one segment, limited volume

**New approach (Gutenberg model):**
- 5 offers × 3 message frameworks = 15 combinations to test
- Tiered targeting weighted toward proven ICP segments
- Higher volume with systematic variation
- Scale what wins, cut what doesn't

We're building toward a 100K contact list across all segments. The professional services campaign was the last "old way" send. From here, we run the new playbook.

---

## Metrics We're Tracking

| Metric | What It Tells Us |
|--------|------------------|
| Open rate | Deliverability health |
| Reply rate | Message resonance |
| Positive reply rate | Offer fit |
| Meetings booked | Bottom-line conversion |
| Segment performance | Which verticals convert |
| Offer performance | Which hooks win |

---

## Process Fixes

| Issue | Fix | Owner |
|-------|-----|-------|
| Clay → SmartLeads sync dropped 500 contacts | Add pre-launch QA step to verify full sync | Keegan Moody |
| No variation testing | Implement Gutenberg framework (5 offers × 3 messages) | Keegan Moody |
| Targeting outside core ICP | Weight future campaigns toward Software/SaaS, 50-200 employees | Keegan Moody |

---

## Bottom Line

This campaign didn't fail — it revealed that low-volume, single-variant outbound can't move the needle on a TAM this large.

**The learnings:**
1. Target the real ICP (Software/SaaS > professional services)
2. Test at scale with variation (Gutenberg model)
3. Lock down infrastructure (QA sync before send)
4. Measure deliverability first (open rates as leading indicator)

We're ready to run the new playbook.

---

*Last updated: November 2025*
