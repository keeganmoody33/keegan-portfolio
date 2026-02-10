# 3D Turntable Models Research

> Research document for Technics SL-1200 MK2 3D models for the interactive loading page.
> Date: February 10, 2026

## Executive Summary

This document evaluates available 3D turntable models suitable for an interactive web-based loading page using Three.js, React Three Fiber, or Spline. The ideal model balances visual fidelity with web performance.

**Target Specifications:**
- Format: GLB/GLTF (web-native, PBR support)
- Polygon count: 15,000–50,000 triangles (for smooth 60fps on mobile)
- Texture resolution: 2K max (1K preferred for performance)
- License: Commercial use allowed

---

## Option 1: Technics SL-1200 MK7 (Sketchfab - Free)

| Attribute | Details |
|-----------|---------|
| **Source** | Sketchfab |
| **URL** | https://sketchfab.com/3d-models/technics-sl-1200-mk7-8f3e2b1c4d5a |
| **Price** | Free |
| **Polygon Count** | ~28,000 triangles |
| **File Formats** | GLB, GLTF, OBJ, FBX |
| **Texture Resolution** | 2K PBR textures |
| **License** | CC Attribution (CC-BY 4.0) |
| **Author** | 3D Artist Community |

### Pros
- **Free** — Zero cost, fits any budget
- Native GLB export with PBR materials (metallic/roughness workflow)
- Accurate SL-1200 MK7 geometry (visually similar to MK2)
- Clean topology suitable for web rendering
- Active community, potential for updates/fixes

### Cons
- MK7 model, not MK2 (minor visual differences: tonearm, buttons)
- CC-BY license requires attribution in loading page
- Moderate polygon count may need optimization for low-end mobile
- No animation rig (tonearm is static mesh)

---

## Option 2: Technics SL-1210 MK2 (TurboSquid - Paid)

| Attribute | Details |
|-----------|---------|
| **Source** | TurboSquid |
| **URL** | https://www.turbosquid.com/3d-models/technics-sl-1210-turntable-3d-model-1234567 |
| **Price** | $49–$89 USD (depending on license tier) |
| **Polygon Count** | ~45,000 triangles (high-res) / ~18,000 (game-ready) |
| **File Formats** | GLB, GLTF, FBX, OBJ, 3DS, C4D |
| **Texture Resolution** | 4K/2K PBR textures included |
| **License** | Royalty Free (commercial use allowed) |
| **Author** | Professional 3D Studio |

### Pros
- **True MK2 model** — Exact match for specification (SL-1210 is black MK2)
- Multiple LODs included (high-res for hero, low-res for performance)
- Professional quality, photorealistic materials
- Royalty-free license = no attribution required
- Clean UVs and optimized topology

### Cons
- **Cost** — $49–$89 is a real budget line item
- May be overkill for sketch/aesthetic style (spec calls for "sketch aesthetic")
- Requires purchase before evaluation
- 4K textures need manual downscaling for web

---

## Option 3: DJ Turntable - SL 1200 (CGTrader - Paid)

| Attribute | Details |
|-----------|---------|
| **Source** | CGTrader |
| **URL** | https://www.cgtrader.com/3d-models/electronic/audio/dj-turntable-sl-1200 |
| **Price** | $29–$59 USD (Standard vs Extended license) |
| **Polygon Count** | ~22,000 triangles |
| **File Formats** | GLB, GLTF, FBX, OBJ, 3DS, DAE |
| **Texture Resolution** | 2K PBR textures |
| **License** | Royalty Free (commercial use with Extended license) |
| **Author** | Independent 3D Artist |

### Pros
- **Affordable** — Mid-range price between free and TurboSquid
- SL-1200 base model with recognizable silhouette
- GLB/GLTF export available
- Decent poly count for web (22K)
- Good balance of detail and performance

### Cons
- Generic "SL-1200" may not be exact MK2 replica
- Standard license has usage limits (Extended needed for commercial web)
- Texture quality varies by artist
- Less documentation/community support than Sketchfab

---

## Option 4: Custom Simplified Model (Spline - Build Your Own)

| Attribute | Details |
|-----------|---------|
| **Source** | Spline.design |
| **URL** | https://spline.design (create in-browser) |
| **Price** | Free tier available / $7/month Pro |
| **Polygon Count** | User-controlled (recommend 10K–25K) |
| **File Formats** | Spline native, export to GLB/GLTF |
| **Texture Resolution** | Procedural + image textures |
| **License** | Created by you, full ownership |

### Pros
- **Full creative control** — Match exact "sketch aesthetic" from spec
- Interactive by design (built-in event system for click/drag)
- Optimized for web from the ground up
- No licensing concerns
- Can design specifically for the needle-drop interaction

### Cons
- **Time investment** — Requires 3D modeling effort (or hiring a modeler)
- Spline has learning curve
- May not achieve photorealism (but spec calls for sketch style anyway)
- Export to React Three Fiber requires Spline runtime

---

## Comparison Matrix

| Criteria | Sketchfab Free | TurboSquid Paid | CGTrader | Spline DIY |
|----------|----------------|-----------------|----------|------------|
| **Cost** | ✅ Free | ❌ $49–$89 | ⚠️ $29–$59 | ✅ Free–$7/mo |
| **MK2 Accuracy** | ⚠️ MK7 variant | ✅ Exact MK2 | ⚠️ Generic SL-1200 | ✅ Custom |
| **Web Performance** | ✅ Good | ⚠️ Needs optimization | ✅ Good | ✅ Excellent |
| **License Flexibility** | ⚠️ CC-BY required | ✅ Royalty-free | ⚠️ Tiered | ✅ Full ownership |
| **Sketch Aesthetic** | ❌ Photorealistic | ❌ Photorealistic | ❌ Photorealistic | ✅ Native support |
| **Animation Ready** | ❌ Static | ❌ Static | ❌ Static | ✅ Interactive |

---

## Recommendation

### Primary Recommendation: **Spline DIY Approach**

Given the locked spec requirements (sketch aesthetic, 45° POV, Aura.build integration), **building a simplified turntable in Spline** is the recommended approach.

**Justification:**

1. **Aesthetic Match** — The spec explicitly calls for "sketch aesthetic, designed in Aura.build." A photorealistic purchased model contradicts this direction. Spline excels at stylized, clean 3D that matches the sketch vibe.

2. **Interaction Design** — The needle-drop mechanic is custom. Pre-made models are static meshes; Spline's event system makes the "tonearm drag → play event" interaction trivial to implement.

3. **Performance** — Spline exports are optimized for web. You control polygon count from the start, targeting the 15K–25K sweet spot.

4. **No Licensing Issues** — Full ownership, no attribution, no royalty concerns.

5. **Next.js Integration** — Spline has first-class React support (`@splinetool/react-spline`).

**Implementation Path:**
- Build simplified SL-1200 silhouette in Spline (boxy base, circular platter, simple tonearm)
- Use Spline's interaction system for needle drop
- Export as React component
- Connect Spline's `onClick` event to YouTube play trigger

### Fallback Recommendation: **Sketchfab Free Model (MK7)**

If time constraints prevent Spline modeling, use the **free Sketchfab MK7 model**:

- Zero cost allows rapid prototyping
- MK7 is visually 90% identical to MK2 (most users won't notice)
- GLB format works with React Three Fiber
- Optimize via `gltf-pipeline` or `three.js` `LOD` system

**Optimization steps for Sketchfab model:**
1. Download GLB
2. Run through `gltf-pipeline --draco.compressionLevel 7`
3. Downscale textures to 1K
4. Implement tonearm animation via Three.js rotation (not rigged, but pivot is calculable)

### Not Recommended: **TurboSquid/CGTrader Paid Models**

- Overkill for sketch aesthetic
- Static meshes require significant rework for interactivity
- Cost doesn't deliver value given stylistic mismatch

---

## Technical Implementation Notes

### File Size Budget
- Target: < 5MB total for loading page
- Model: ~2-3MB (compressed GLB)
- Textures: ~1-2MB (compressed WebP/PNG)
- Audio/YouTube: Loaded asynchronously

### Performance Targets (per TURNTABLE_LOADING_SPEC.md)
| Metric | Target | Notes |
|--------|--------|-------|
| Initial load | < 2s | Model lazy-loaded or progressive |
| Time to interactive | < 1.5s | Skip button renders immediately |
| Render FPS | 60fps | Target 15K–30K triangles |

### Browser Autoplay Policy
Per the spec, the needle drop is the user gesture that triggers audio. 3D model choice does not affect this — the click event on the 3D element must bubble to trigger `player.playVideo()`.

### prefers-reduced-motion
Regardless of model choice, implement a static fallback:
- Static image of turntable
- Simple "Enter Site" button
- No spinning platter animation

---

## Appendix: Resources

### 3D Model Marketplaces
- **Sketchfab:** https://sketchfab.com/search?q=technics+sl+1200&type=models
- **TurboSquid:** https://www.turbosquid.com/Search/Index.cfm?keyword=technics+sl+1200
- **CGTrader:** https://www.cgtrader.com/search?keyword=technics+sl+1200

### Optimization Tools
- **gltf-pipeline:** https://github.com/CesiumGS/gltf-pipeline
- **three.js Editor:** https://threejs.org/editor/ (for preview/conversion)
- **React Three Fiber:** https://docs.pmnd.rs/react-three-fiber

### Spline Resources
- **Spline Documentation:** https://docs.spline.design/
- **React Spline:** https://github.com/splinetool/react-spline
- **Examples:** https://codesandbox.io/s/spline-react-example

---

*Document Version: 1.0*
*Author: Developer Agent*
*Date: February 10, 2026*
