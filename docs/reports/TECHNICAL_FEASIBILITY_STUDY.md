# Technical Feasibility Study — Technics SL-1200 MK2 Interactive 3D Loading Page

**Project:** lecturesfrom.com/keeganmoody33  
**Date:** February 10, 2026  
**Status:** Research Complete — Ready for Implementation Decision  
**Compiled by:** Antfarm Research Workflow

---

## Executive Summary

This feasibility study evaluates the technical approach for implementing an interactive 3D Technics SL-1200 MK2 turntable as the portfolio loading page. The turntable serves as both an immersive brand experience and a functional audio gateway — the needle drop triggers YouTube audio playback before transitioning to the main portfolio.

**Feasibility Verdict:** ✅ **FEASIBLE** with recommended approach below.

### Key Findings

| Aspect | Finding |
|--------|---------|
| **3D Model** | Spline DIY recommended (sketch aesthetic) OR Sketchfab MK7 free model |
| **Engine** | Spline (~280KB) — smallest bundle, fastest dev, matches aesthetic |
| **Audio Autoplay** | Achievable via synchronous user gesture handling |
| **Performance** | 500KB budget achievable with compression |
| **Browser Support** | All modern browsers (Chrome, Safari, Firefox, Edge) |

---

## 1. 3D Turntable Model Options

### Recommended: Spline DIY Approach

**Rationale:** The spec explicitly calls for "sketch aesthetic, designed in Aura.build." Spline's design-first approach matches this direction perfectly.

| Attribute | Details |
|-----------|---------|
| **Cost** | Free tier ($7/mo Pro for advanced exports) |
| **Style** | Native sketch/stylized aesthetic support |
| **Bundle Impact** | ~280KB runtime |
| **Control** | Full creative control, no licensing issues |
| **Time to MVP** | Fastest — visual editor, minimal code |

**Implementation Path:**
1. Build simplified SL-1200 in Spline (base, platter, tonearm, record)
2. Define `needleDrop` event in Spline editor
3. Export as React component
4. Connect to YouTube player API

### Fallback: Sketchfab Free (MK7 Model)

| Attribute | Details |
|-----------|---------|
| **URL** | sketchfab.com/3d-models/technics-sl-1200-mk7 |
| **Cost** | Free (CC-BY 4.0) |
| **Polygons** | ~28,000 |
| **Format** | GLB with PBR textures |
| **Note** | MK7 not MK2, but visually 90% similar |

**Optimization Required:**
```bash
gltf-pipeline -i turntable.glb -o turntable-draco.glb --draco.compressionLevel=7
```

### Not Recommended: Paid Models (TurboSquid/CGTrader)

- $29-$89 cost with no aesthetic benefit
- Photorealistic style conflicts with "sketch" direction
- Static meshes require rework for interactivity

---

## 2. 3D Engine Comparison

### Recommendation: Spline

| Criteria | Spline | React Three Fiber | Three.js |
|----------|--------|-------------------|----------|
| **Bundle Size** | ✅ ~280KB | ⚠️ ~350KB | ❌ ~600KB |
| **Sketch Aesthetic** | ✅ Native | ❌ Manual config | ❌ Manual shaders |
| **Dev Speed** | ✅ Fastest | ⚠️ Moderate | ❌ Slow |
| **Tonearm Interaction** | ✅ Visual editor | ⚠️ Code required | ⚠️ Code required |
| **Next.js Integration** | ✅ `@splinetool/react-spline` | ⚠️ `'use client'` | ⚠️ `'use client'` |
| **Learning Curve** | ✅ Low | ⚠️ Moderate | ❌ Steep |

**Bundle Budget Analysis:**
```
Current portfolio: ~150KB
+ Spline runtime: ~280KB
= Total: ~430KB ✅ (under 500KB limit)
```

---

## 3. Audio Autoplay Strategy

### The Challenge

Browsers block audio autoplay unless preceded by a user gesture. The turntable needle drop IS the user gesture.

### Critical Implementation Pattern

```typescript
// ✅ CORRECT: Synchronous play within gesture handler
function handleNeedleDrop() {
  player.playVideo(); // IMMEDIATE — while activation valid
  animateTonearm();   // Non-blocking animation after
}

// ❌ WRONG: Async gap breaks user activation
function handleNeedleDrop() {
  animateTonearm().then(() => {
    player.playVideo(); // Too late! Activation expired.
  });
}
```

### Browser Compatibility

| Browser | Autoplay Policy | Requirement |
|---------|-----------------|-------------|
| **Safari 17+** | Strictest | Synchronous play() only |
| **Chrome 120+** | Moderate | User gesture, 5s window |
| **Firefox 120+** | Moderate | User gesture unlocks session |

**Key Insight:** If it works in Safari, it works everywhere.

### State Handoff to Banner

```typescript
// Save on loading page
sessionStorage.setItem('portfolio_audio_state', JSON.stringify({
  videoId, currentTime, isPlaying, volume,
  timestamp: Date.now() // 5-min expiry
}));

// Restore on portfolio
const state = JSON.parse(sessionStorage.getItem('portfolio_audio_state'));
// Resume YouTube player with saved position
```

---

## 4. Performance Budget

### Hard Limits

| Metric | Target | Maximum |
|--------|--------|---------|
| **Total Page Weight** | 350KB | 500KB |
| **3D Model (GLB)** | 200KB | 300KB |
| **Time to Interactive** | 2.0s | 3.0s (4G) |
| **Polygon Count** | 15,000 | 25,000 |
| **Texture Resolution** | 1K | 2K |

### Optimization Pipeline

1. **Draco Compression:** 80-95% size reduction
2. **Texture Compression:** Basis Universal (KTX2)
3. **Code Splitting:** Dynamic import for 3D component
4. **Lazy Loading:** Static placeholder → 3D model

### Progressive Enhancement Tiers

| Tier | Device | Experience |
|------|--------|------------|
| **1** | High-end, WiFi | Full 3D, 1K textures, shadows |
| **2** | Mid-range, 4G | Reduced materials, 512 textures |
| **3** | Low-end, 3G | Static image + CSS animation |
| **4** | `prefers-reduced-motion` | Skip loading page entirely |

---

## 5. Feature Requirements Implementation

### Return Visitor Skip (localStorage)

```typescript
if (localStorage.getItem('hasVisited')) {
  redirectToPortfolio();
}
// After first visit:
localStorage.setItem('hasVisited', 'true');
```

### prefers-reduced-motion

```typescript
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

if (prefersReducedMotion) {
  return <DirectPortfolioEntry />;
}
```

### Skip Button (Clever Copy)

> "I don't like music" / "silence please" / "party pooper entrance"

Position: Bottom-right, subtle, makes user feel "lame" for skipping.

### Audio + Transition Flow

```
[User lands on /loading]
         ↓
[3D turntable renders]
         ↓
[User clicks tonearm (needle drop)]
         ↓
[SYNCHRONOUS: player.playVideo()]
         ↓
[Animate tonearm down, platter spins]
         ↓
[Transition to portfolio]
         ↓
[Banner player reads sessionStorage, resumes]
```

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Bundle size exceed** | Medium | High | Draco compression, strict budget |
| **Safari GPU memory crash** | Medium | Critical | 1K texture limit, memory monitoring |
| **Autoplay blocked** | Low | Medium | Detection + unblock prompt |
| **Slow 3G timeout** | Low | Medium | 10s max, skip button always visible |
| **Spline vendor lock-in** | Low | Low | Can export GLB if needed |

---

## 7. Recommended Implementation Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **3D Engine** | Spline | Sketch aesthetic, smallest bundle |
| **Framework** | Next.js 14+ | App Router, dynamic imports |
| **Audio** | YouTube IFrame API | Existing playlist integration |
| **State** | sessionStorage | Handoff to banner player |
| **Styling** | Tailwind CSS | Consistent with portfolio |
| **Analytics** | PostHog | `turntable_loaded`, `needle_dropped` events |

---

## 8. Implementation Phases

### Phase 1: MVP (Week 1)
- Spline scene with basic turntable geometry
- Needle drop → playVideo() → transition
- Skip button + localStorage check
- Basic responsive layout

### Phase 2: Polish (Week 2)
- Tonearm drag interaction refinement
- Transition animations (fade/zoom)
- prefers-reduced-motion support
- Performance optimization

### Phase 3: Enhancement (Future)
- Realistic platter animation (33 RPM)
- Dust particles / groove tracking visual
- Mobile touch interaction polish
- Advanced device tier detection

---

## 9. Success Criteria

- [ ] 3D turntable renders in <2s on 4G
- [ ] Needle drop triggers synchronous audio playback
- [ ] Music continues seamlessly in banner player
- [ ] Skip button works for accessibility
- [ ] Return visitors bypass loading page
- [ ] prefers-reduced-motion respected
- [ ] Total bundle <500KB
- [ ] 60fps on mid-range mobile devices

---

## 10. Alternatives Considered

### Alternative 1: Static Image + CSS Animation
**Verdict:** Rejected — Doesn't meet "interactive 3D" requirement, but acceptable as fallback.

### Alternative 2: Video Background
**Verdict:** Rejected — No interactivity, larger file size, poor mobile performance.

### Alternative 3: Lottie Animation
**Verdict:** Rejected — JSON-based, limited interactivity, tonearm pivot difficult.

---

## Conclusion

The Technics SL-1200 MK2 interactive 3D loading page is **technically feasible** with the recommended Spline-based approach. The key success factors are:

1. **Synchronous audio trigger** within the user gesture handler
2. **Aggressive compression** to meet 500KB budget
3. **Progressive enhancement** with graceful fallbacks
4. **Thorough testing** on Safari (the strictest browser)

**Next Step:** Create Spline scene, implement MVP, test on target devices.

---

## Appendix: Reference Documents

- `3d-models.md` — Detailed model options and comparison matrix
- `3d-engines.md` — Engine comparison with code examples
- `audio-autoplay.md` — Browser autoplay policies and implementation patterns
- `performance-budget.md` — Performance targets and optimization strategies
- `TURNTABLE_LOADING_SPEC.md` — Original product requirements

---

*Study Version: 1.0*  
*Compiled: February 10, 2026*  
*Status: Ready for implementation*
