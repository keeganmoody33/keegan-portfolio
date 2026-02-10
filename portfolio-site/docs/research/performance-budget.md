# 3D Loading Page Performance Budget

> Performance budget and optimization guidelines for the Technics SL-1200 MK2 interactive 3D loading page.
> Date: February 10, 2026

## Executive Summary

This document establishes performance budgets and optimization strategies for the interactive 3D turntable loading page. Given that this is a **loading page** — the user's first interaction with the site — performance is critical. A slow loading page defeats its own purpose.

**Key Principle:** The 3D experience must enhance, not hinder, the transition to the main site.

---

## Performance Budgets

### 1. Total Page Weight Budget

| Metric | Target | Maximum | Notes |
|--------|--------|---------|-------|
| **Total Transfer Size** | <350KB | 500KB | Includes HTML, CSS, JS, 3D model, textures |
| **First Load (uncached)** | <500KB | 750KB | With all assets |
| **Repeat Load (cached)** | <50KB | 100KB | Only dynamic/API data |

**Budget Breakdown:**

```
Total Budget: 500KB
├── HTML/CSS/JS (compressed): 100KB
├── 3D Model (GLB, Draco compressed): 250KB
├── Textures (compressed): 100KB
├── Audio (if preloaded): 50KB
└── Buffer/Overhead: 50KB
```

### 2. 3D Model Size Limits

| Metric | Target | Maximum | Rationale |
|--------|--------|---------|-----------|
| **GLB File Size** | <200KB | 300KB | After Draco compression |
| **Polygon Count** | 15,000 | 25,000 | Tris, not quads |
| **Vertex Count** | <20,000 | 30,000 | For morph targets/animation |
| **Texture Memory** | <50MB | 100MB | GPU texture memory at runtime |
| **Texture Resolution** | 1K (1024x1024) | 2K (2048x2048) | Power-of-two dimensions |
| **Number of Textures** | 2-3 | 5 | Albedo + Normal + (Optional) Roughness |

### 3. Time-to-Interactive (TTI) Targets

| Connection | TTI Target | Maximum | First Contentful Paint |
|------------|-----------|---------|----------------------|
| **4G/LTE** | <2.0s | 3.0s | <1.0s |
| **3G Fast** | <3.5s | 5.0s | <2.0s |
| **3G Slow** | <5.0s | 7.0s | <3.0s |
| **Desktop WiFi** | <1.5s | 2.0s | <0.8s |

**TTI Definition:** Time from navigation start until the page is fully interactive — the 3D model is loaded, rendered, and the play button responds to user input.

### 4. Lighthouse Performance Score Targets

| Metric | Target | Minimum | Weight |
|--------|--------|---------|--------|
| **Performance Score** | 90+ | 75 | - |
| **First Contentful Paint (FCP)** | <1.0s | <1.8s | 10% |
| **Largest Contentful Paint (LCP)** | <2.0s | <2.5s | 25% |
| **Total Blocking Time (TBT)** | <150ms | <350ms | 30% |
| **Cumulative Layout Shift (CLS)** | <0.05 | <0.1 | 25% |
| **Speed Index** | <2.0s | <3.4s | 10% |

### 5. 3G/Throttled Connection Performance

**Throttling Profile for Testing:**
```
Download: 1.6 Mbps (3G Fast)
Upload: 0.75 Mbps
Latency: 150ms
```

**Acceptable Degradation on 3G:**
- 3D model may take up to 5s to fully load
- Lower resolution textures acceptable (512x512 fallback)
- Reduced animation complexity (simpler rotations)
- Optional: Skip 3D entirely, show static image + "Enter" button

### 6. GPU Memory Considerations (Mobile)

| Device Tier | GPU Memory | Max Texture Size | Recommendation |
|-------------|-----------|------------------|----------------|
| **High-end** | 4GB+ | 4K | Full experience |
| **Mid-range** | 2GB | 2K | Reduced shadows |
| **Low-end** | 512MB-1GB | 1K | Simplified materials |
| **Budget** | <512MB | 512 | Static image fallback |

**Mobile-Specific Constraints:**
- iOS Safari: 384MB GPU memory limit per tab (can crash if exceeded)
- Android: Highly variable, assume 1GB max for compatibility
- Thermal throttling: Complex 3D causes devices to heat up and throttle

---

## Optimization Checklist

### Pre-Production (Model Preparation)

- [ ] **Polygon Reduction**
  - Target: 15,000-25,000 triangles
  - Remove internal geometry (parts never visible)
  - Merge vertices where possible
  - Use LOD (Level of Detail) meshes if available

- [ ] **Texture Optimization**
  - Use 1K textures maximum (1024x1024)
  - Combine textures into atlases where possible
  - Use power-of-two dimensions (512, 1024, 2048)
  - Prefer JPG for opaque textures, PNG only for transparency

### Build-Time Optimization

- [ ] **Draco Compression**
  ```bash
  # Using gltf-pipeline
  gltf-pipeline -i turntable.glb -o turntable-draco.glb --draco.compressionLevel=7
  ```
  - Compression level: 7-10 (higher = smaller, slower decode)
  - Expected reduction: 80-95% file size
  - Decode time: <100ms on modern devices

- [ ] **Basis Universal Texture Compression**
  - Format: KTX2 with Basis Universal
  - GPU memory reduction: 4-6x
  - Cross-platform compatible
  - Tool: `toktx` or `gltf-transform encode`

- [ ] **Mesh Optimization**
  ```bash
  # Using gltf-transform
  gltf-transform optimize input.glb output.glb \
    --compress draco \
    --texture-compress webp \
    --texture-size 1024
  ```

### Runtime Optimization

- [ ] **Lazy Loading Strategy**
  ```typescript
  // Pseudocode
  if (userVisitedBefore && localStorage.getItem('skipLoading')) {
    // Skip 3D entirely
    redirectToMainSite();
  } else {
    // Load 3D model asynchronously
    import('./TurntableScene').then(module => {
      module.init();
    });
  }
  ```

- [ ] **Progressive Loading**
  1. Show static placeholder immediately (<50KB SVG)
  2. Load low-poly model first (50KB)
  3. Stream high-res textures in background
  4. Swap when ready

- [ ] **Code Splitting**
  ```typescript
  // Dynamic import for 3D library
  const Spline = dynamic(() => import('@splinetool/react-spline'), {
    ssr: false,
    loading: () => <StaticTurntablePlaceholder />
  });
  ```

- [ ] **Resource Hints**
  ```html
  <link rel="preload" href="/turntable-draco.glb" as="fetch" crossorigin>
  <link rel="preconnect" href="https://prod.spline.design">
  ```

### Post-Load Optimization

- [ ] **Animation Frame Budget**
  - Target: 60fps (16.67ms per frame)
  - 3D rendering budget: 8-10ms max
  - Use `requestAnimationFrame` with delta time
  - Pause rendering when tab not visible (`visibilitychange`)

- [ ] **Garbage Collection Mitigation**
  - Reuse geometries/materials
  - Avoid creating objects in animation loop
  - Pool objects where possible

---

## Progressive Enhancement Strategy

### Tier 1: Full Experience (High-end Devices, Fast Connection)
- Interactive 3D turntable with full animations
- High-quality textures (1K-2K)
- Real-time shadows and reflections
- Audio preview on hover

### Tier 2: Reduced Experience (Mid-range, 3G)
- Interactive 3D with simplified materials
- 512x512 textures
- Reduced shadow quality
- Static audio (no preview)

### Tier 3: Fallback (Low-end, Slow Connection)
- Static image of turntable
- CSS-based "spin" animation
- Clear "Enter Site" button
- No 3D library loaded

### Tier 4: Accessibility (`prefers-reduced-motion`)
- Skip loading page entirely
- Direct navigation to main site
- Or: Static page with instant entry

---

## Measurement Methodology

### Tools

| Tool | Purpose | Frequency |
|------|---------|-----------|
| **Lighthouse CI** | Automated performance audits | Every PR |
| **WebPageTest** | Real device testing | Weekly |
| **Chrome DevTools** | Local profiling | During dev |
| **Sentry Performance** | Real User Monitoring (RUM) | Production |

### Key Metrics to Track

```typescript
// Web Vitals tracking
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);  // Cumulative Layout Shift
getFID(console.log);  // First Input Delay
getFCP(console.log);  // First Contentful Paint
getLCP(console.log);  // Largest Contentful Paint
getTTFB(console.log); // Time to First Byte
```

### Custom 3D-Specific Metrics

```typescript
// Track 3D loading performance
performance.mark('3d-model-start');
// ... load model ...
performance.mark('3d-model-end');
performance.measure('3d-model-load', '3d-model-start', '3d-model-end');

// Send to analytics
analytics.track('3d_performance', {
  modelLoadTime: measurement.duration,
  modelSize: modelSizeBytes,
  deviceTier: getDeviceTier(),
  connection: navigator.connection?.effectiveType
});
```

### Testing Protocol

1. **Synthetic Testing**
   ```bash
   # Lighthouse CI config
   module.exports = {
     ci: {
       collect: {
         url: ['http://localhost:3000/loading'],
         numberOfRuns: 5
       },
       assert: {
         assertions: {
           'categories:performance': ['error', { minScore: 0.9 }],
           'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
           'largest-contentful-paint': ['error', { maxNumericValue: 2500 }]
         }
       }
     }
   };
   ```

2. **Real Device Testing Matrix**
   | Device | Connection | Expected TTI |
   |--------|-----------|--------------|
   | iPhone 15 Pro | WiFi | <1.5s |
   | iPhone 12 | 4G | <2.5s |
   | Samsung A52 | 3G | <5s |
   | Moto G Power | 3G | <7s or fallback |

3. **Load Testing**
   - Test with browser cache disabled
   - Test with service worker (repeat visits)
   - Test with slow 3G throttling

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **3D model too large** | Medium | High | Draco compression, LOD meshes |
| **Mobile performance poor** | High | High | Device tier detection, fallback |
| **Safari GPU memory crash** | Medium | Critical | Memory monitoring, texture limits |
| **Autoplay blocked + 3D load time** | Medium | Medium | Load audio async, visual feedback |
| **Slow connection timeout** | Low | Medium | 10s max load, show skip button |

---

## Recommended Approach Summary

1. **Set hard limit:** 500KB total page weight
2. **Compress aggressively:** Draco + Basis Universal
3. **Detect and adapt:** Device tier-based quality
4. **Always provide escape:** Skip button + reduced-motion support
5. **Measure everything:** RUM + synthetic monitoring
6. **Fail gracefully:** Static fallback for low-end devices

---

## References

- [Google Web Vitals](https://web.dev/vitals/)
- [GLTF Draco Compression](https://github.com/google/draco)
- [Basis Universal Texture Compression](https://github.com/BinomialLLC/basis_universal)
- [gltf-transform](https://gltf-transform.dev/)
- [Spline Performance Guide](https://www.spline.design/)
- [React Three Fiber Performance](https://docs.pmndrs.dev/react-three-fiber/advanced/scaling-performance)
