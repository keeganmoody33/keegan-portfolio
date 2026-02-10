# Linear Backlog Triage — LEC-5 through LEC-18

**Triage Date:** 2026-02-10  
**Analyst:** CurtisCritical  
**Scope:** Copy fixes, banner widgets, Alan Iverson feature, Discogs integration

---

## Issue Breakdown

| Issue | Title/Scope | Difficulty | Notes | Recommendation |
|-------|-------------|------------|-------|----------------|
| **LEC-5** | Copy fix | 🟢 Easy | Text correction | Smoke test candidate |
| **LEC-6** | Copy fix | 🟢 Easy | Text correction | Smoke test candidate |
| **LEC-7** | Banner widget | 🟡 Medium | Dimensions, content, animation | **First real feature** |
| **LEC-8** | Copy fix | 🟢 Easy | Text correction | Smoke test candidate |
| **LEC-9** | Copy fix | 🟢 Easy | Text correction | Smoke test candidate |
| **LEC-10** | Copy fix | 🟢 Easy | Text correction | Smoke test candidate |
| **LEC-11** | Copy fix | 🟢 Easy | Text correction | Smoke test candidate |
| **LEC-12** | Copy fix | 🟢 Easy | Text correction | Smoke test candidate |
| **LEC-13** | Alan Iverson feature — Part 1 | 🔴 Hard | Break into atomic pieces | Decompose first |
| **LEC-14** | Copy fix | 🟢 Easy | Text correction | Smoke test candidate |
| **LEC-15** | Copy fix | 🟢 Easy | Text correction | Smoke test candidate |
| **LEC-16** | Alan Iverson feature — Part 2 | 🔴 Hard | Continuation of LEC-13 | Bundle with 13/17 |
| **LEC-17** | Alan Iverson feature — Part 3 | 🔴 Hard | Final piece of AI feature | Bundle with 13/16 |
| **LEC-18** | Banner widget (related) | 🟡 Medium | May combine with LEC-7 | Bundle with LEC-7 |

---

## Recommended Next 3 Issues

### 1. LEC-7: Banner Widget (Primary)
**Why first:** First real feature after smoke tests  
**Scope tightly:**
- Exact dimensions (width/height)
- Content type (static, rotating, interactive?)
- Animation behavior (fade, slide, etc.)
- Mobile behavior

**Acceptance criteria template:**
```
Banner displays at [Xpx] width × [Ypx] height
Content: [specific content or source]
Animation: [type] with [timing] duration
Mobile: [responsive behavior]
```

**Estimation:** 1-2 Antfarm runs (may need iteration)

---

### 2. LEC-18: Banner Widget (Related) + LEC-7 Bundle
**Why second:** Related to LEC-7, may be same component  
**Approach:** 
- Review LEC-7 PR first
- If LEC-18 is extension/refinement, bundle into follow-up request
- If separate widget, scope independently

**Decision point:** After LEC-7 merges, evaluate if LEC-18 is:
- A) Same component → add to LEC-7 branch
- B) Separate widget → new workflow run
- C) Enhancement → new feature request

---

### 3. Discogs Widget: "Recent Digs" Display
**Why third:** Distinct feature, good for workflow calibration  
**Not in original LEC-5/18 list but referenced in specs:**

**Scope tightly:**
```
Component: RecentDigs widget
Data: Discogs API (existing /api/discogs route)
Display: [X] albums, [layout type]
Refresh: [interval] or [manual]
Fallback: [behavior when API fails]
```

**Already exists:** `components/RecentDigs.tsx` — may need enhancement, not from-scratch

**Check first:** Is this LEC-19+ or unlabeled? Review existing component vs. desired state.

---

## Bundle Recommendations

### Copy Fixes (LEC-5,6,8-12,14,15)
**Count:** 10 issues  
**Approach:** Batch into 2-3 Antfarm runs (3-4 fixes per run)  
**Example request:**
```
Fix copy on 4 sections of portfolio:
1. Hero section: "X" → "Y" in src/components/Hero.tsx
2. About section: "A" → "B" in src/components/About.tsx
3. [etc]
```

### Alan Iverson Feature (LEC-13,16,17)
**Count:** 3 issues  
**Complexity:** 🔴 Hard  
**Status:** Needs decomposition  

**From spec docs:** This appears to be an AI-powered feature (possibly the chat interface or JD analyzer)

**Recommendation:** 
1. Review `docs/ALAN_IVERSON_SPEC.md` first
2. Decompose into atomic user stories:
   - Story 1: [Specific component]
   - Story 2: [Specific behavior]
   - Story 3: [Specific integration]
3. Feed one story per Antfarm run

**Do not** feed entire LEC-13/16/17 as single request — scope is too broad.

---

## Marquee Ticker (Referenced in Elevation Checklist)

**Status:** May be unlabeled or part of banner work  
**Scope questions:**
- Data source: [static, API, file?]
- Refresh interval: [X seconds]
- Fallback: [static fallback if data fails]
- Mobile: [same or different behavior]

**Current implementation:** `components/Marquee.tsx` exists — check if this is enhancement or new feature

---

## Execution Order Summary

| Phase | Issues | Purpose |
|-------|--------|---------|
| **Smoke Test** | LEC-5,6,8-12,14,15 (3-4 per run) | Calibrate workflow |
| **First Feature** | LEC-7 (+ LEC-18 if related) | Real feature validation |
| **Integration** | Discogs widget enhancement | API integration practice |
| **Complex Feature** | Decomposed Alan Iverson stories | Advanced workflow test |

---

## Open Questions for 33

1. **LEC-13/16/17:** What is the Alan Iverson feature? (Have spec doc but need priority confirmation)
2. **Marquee ticker:** Is this a labeled issue or enhancement to existing component?
3. **LEC-18:** Is this the same widget as LEC-7 or separate?
4. **Discogs widget:** Is there a specific Linear issue for RecentDigs enhancements?

---

## Files to Review Before Next Runs

| File | Purpose |
|------|---------|
| `docs/BANNER_WIDGETS_SPEC.md` | LEC-7/18 requirements |
| `docs/ALAN_IVERSON_SPEC.md` | LEC-13/16/17 requirements |
| `components/BannerRotator.tsx` | Current implementation |
| `components/RecentDigs.tsx` | Current Discogs display |
| `components/Marquee.tsx` | Current ticker implementation |

---

*Ready for review. No branches created, no code pushed.*
