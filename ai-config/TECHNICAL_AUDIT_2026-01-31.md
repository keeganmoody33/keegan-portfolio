# Portfolio Technical Audit Report

**Date:** 2026-01-31
**Purpose:** Visibility into technical debt, security posture, and standards compliance
**Status:** Checkpoint reference — no action taken

---

## Table of Contents
1. [Dependency Status](#1-dependency-status)
2. [Security Audit](#2-security-audit)
3. [Accessibility Audit](#3-accessibility-audit)
4. [Performance Audit](#4-performance-audit)
5. [Glossary](#5-glossary)

---

## 1. Dependency Status

### Summary
Dependencies are relatively current. Nothing is broken, but some items are aging.

| Package/Import | Current | Latest | Gap | Risk |
|----------------|---------|--------|-----|------|
| Deno std lib | 0.168.0 | 0.213.0+ | ~45 versions | Security patches may be missing |
| Anthropic API version | 2023-06-01 | 2024-06-01 | 1 year | Missing newer features |
| Claude model | sonnet-4-20250514 | opus-4-5-20251101 | 6 months | Quality/reasoning improvements |
| Next.js | 14.1.0 | Current | Up to date | None |
| React | 18.x | Current | Up to date | None |
| Supabase JS | 2.39.0 | Current | Up to date | None |
| Tailwind | 3.3.0 | 3.x current | Up to date | None |

### What This Means
- **Deno std lib:** The HTTP server code for Edge Functions. Older versions might have unpatched bugs.
- **Anthropic API version:** A header that tells Anthropic which API behavior you expect. Older versions still work.
- **Claude model:** The AI model powering the chat. Newer models have better reasoning but cost more.

---

## 2. Security Audit

### 2.1 CORS Configuration — OPEN

**What is CORS?**
Cross-Origin Resource Sharing. A browser security feature that controls which websites can call your API.

**Current setting:**
```typescript
// supabase/functions/chat/index.ts, line 10
// supabase/functions/jd-analyzer/index.ts, line 11
"Access-Control-Allow-Origin": "*"
```

**What `*` means:**
ANY website on the internet can call these Edge Functions.

**Why this matters:**
| Risk | Description |
|------|-------------|
| **Cost** | Someone could build a site that uses your API. You pay for every Anthropic API call. |
| **Abuse** | Functions could be used as a free Claude proxy. |
| **Scraping** | Portfolio data could be programmatically harvested. |

**What a fix looks like:**
```typescript
// Only allow requests from your portfolio domain
"Access-Control-Allow-Origin": "https://your-portfolio.vercel.app"
```

**Current risk level:** MEDIUM — Low likelihood someone targets a portfolio site, but easy to fix.

---

### 2.2 Error Message Exposure — LEAKS INFO

**What's happening:**
```typescript
// supabase/functions/chat/index.ts, line 84
return new Response(
  JSON.stringify({
    error: "Internal server error",
    details: error.message  // <-- This exposes internal errors
  })
)
```

**Why this matters:**
If something breaks, the error message goes to the browser. This could reveal:
- Database table names
- File paths
- API error details
- Stack traces

**What a fix looks like:**
```typescript
// Log full error server-side, send generic message to client
console.error("Full error:", error);
return new Response(
  JSON.stringify({ error: "Something went wrong" })
)
```

**Current risk level:** LOW — Mostly a best practice issue.

---

### 2.3 Hardcoded URLs — VISIBLE IN CODE

**What's happening:**
```typescript
// portfolio-site/components/Chat.tsx, line 41
const response = await fetch('https://cvkcwvmlnghwwvdqudod.supabase.co/functions/v1/chat', ...)
```

**Why this matters:**
Supabase project URL is baked into client-side code. Anyone can see it in browser dev tools. Not a security vulnerability per se (the anon key is designed to be public), but not ideal.

**What a fix looks like:**
Move to environment variable:
```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, ...)
```

**Current risk level:** LOW — More of a code hygiene issue.

---

### 2.4 No Input Length Limits

**What's happening:**
Edge Functions accept any input size. Someone could submit a 100,000 character "job description."

**Why this matters:**
- Anthropic charges per token
- Large inputs = higher costs
- Could be used to inflate your bill

**What a fix looks like:**
```typescript
if (jobDescription.length > 10000) {
  return new Response(JSON.stringify({ error: "Input too long" }), { status: 400 });
}
```

**Current risk level:** LOW — Would require intentional abuse.

---

### 2.5 Secrets Management — GOOD

**What's right:**
- `.env.local` is in `.gitignore` ✓
- API keys are in environment variables ✓
- No secrets committed to repo ✓

---

## 3. Accessibility Audit

### 3.1 ARIA Labels — MISSING

**What are ARIA labels?**
Attributes that help screen readers understand interactive elements.

**What's missing:**
| Element | Location | Issue |
|---------|----------|-------|
| Chat modal | page.tsx:215 | No `aria-modal`, `aria-labelledby` |
| Close button | page.tsx:220 | No `aria-label="Close"` |
| Chat input | Chat.tsx | No `aria-label` |
| Theme toggle | ActivityStream.tsx:65-74 | No `aria-label` |

**What a fix looks like:**
```tsx
<button aria-label="Close chat" onClick={closeModal}>×</button>
```

**Current risk level:** MEDIUM — Affects users with screen readers.

---

### 3.2 Keyboard Navigation — PARTIAL

**What works:**
- Form submission ✓
- Button clicking ✓
- Tab navigation ✓

**What's missing:**
| Issue | Description |
|-------|-------------|
| **No focus trap** | When modal opens, Tab key can escape to elements behind it |
| **No Escape key** | Pressing Escape doesn't close the modal |
| **Marquee not pausable** | Keyboard users can't stop the scrolling text |

**What a focus trap looks like:**
When modal opens, Tab cycles only through modal elements. Focus can't escape until modal closes.

---

### 3.3 Color Contrast — SOME FAILURES

**What is color contrast?**
The difference in brightness between text and background. WCAG requires 4.5:1 ratio for normal text.

**Colors:**
| Color | Use | Ratio | Status |
|-------|-----|-------|--------|
| `#C9C9C9` on `#121212` | Body text (dark) | ~10:1 | ✓ PASS |
| `#8B8B8B` on `#121212` | Muted text (dark) | ~3.5:1 | ⚠️ BORDERLINE |
| `#CCFF00` on `#121212` | Lime accent | ~15:1 | ✓ PASS |
| `#FF5F1F` on `#121212` | Orange accent | ~2.1:1 | ✗ FAIL |
| `#FF3131` on `#121212` | Red accent | ~3.2:1 | ⚠️ BORDERLINE |

**Location:** `portfolio-site/app/globals.css`, lines 7-21

---

### 3.4 Reduced Motion — NOT SUPPORTED

**What is reduced motion?**
A user preference for people who get motion sickness or have vestibular disorders. They set this in their OS.

**Animations:**
- Grid shift animation (runs continuously)
- Marquee scrolling text
- SprayText reveal animation

**None of these respect `prefers-reduced-motion`.**

**What a fix looks like:**
```css
@media (prefers-reduced-motion: reduce) {
  .animate-grid-shift { animation: none; }
  .animate-marquee { animation: none; }
}
```

---

### 3.5 Semantic HTML — GOOD

**What's right:**
- Uses `<main>`, `<nav>`, `<section>`, `<footer>`, `<aside>` ✓
- Proper heading hierarchy ✓
- Meaningful section IDs ✓

---

## 4. Performance Audit

### Summary: GOOD

Portfolio is lean. No major performance issues.

| Aspect | Status | Notes |
|--------|--------|-------|
| **Bundle size** | ✓ Good | Only 4 production dependencies |
| **Images** | N/A | No images currently |
| **Fonts** | ✓ Good | Uses `display=swap` for non-blocking load |
| **Lazy loading** | ⚠️ None | All data fetched on page load |
| **Animations** | ⚠️ Continuous | Grid animation runs constantly |

### Minor Items

**Animation cleanup (SprayText.tsx:14-17):**
Timer not cleaned up if component unmounts. Could cause memory leak in edge cases.

**No pagination:**
Fetches all experiences at once. Not an issue now, but would be if data grows.

---

## 5. Glossary

| Term | Definition |
|------|------------|
| **CORS** | Cross-Origin Resource Sharing. Browser security that controls which sites can call your API. |
| **ARIA** | Accessible Rich Internet Applications. HTML attributes for screen readers. |
| **Edge Function** | Serverless code that runs close to users. Supabase functions. |
| **WCAG** | Web Content Accessibility Guidelines. Standards for accessible websites. |
| **Focus trap** | Keeps keyboard focus inside a modal until it closes. |
| **Reduced motion** | OS setting for users sensitive to animation. |
| **Anon key** | Supabase public key. Safe to expose, but has limited permissions. |

---

## Quick Reference: What's Actually Broken vs. Best Practice

| Item | Broken? | Best Practice? |
|------|---------|----------------|
| CORS wildcard | No (works) | Should restrict |
| Error details | No (works) | Should hide |
| Old Deno version | No (works) | Should update |
| Missing ARIA | No (works) | Should add |
| Color contrast | Partial | Should fix orange |
| Focus trap | No (modal works) | Should add |

**Bottom line:** Nothing is broken. These are improvements for security posture, accessibility compliance, and code hygiene.

---

*Audit checkpoint generated 2026-01-31*
