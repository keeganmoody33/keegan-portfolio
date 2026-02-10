# 3D Engine Comparison for Next.js Integration

> Research document comparing Three.js, React Three Fiber, and Spline for the Technics SL-1200 MK2 turntable loading page.
> Date: February 10, 2026

## Executive Summary

This document evaluates three approaches for implementing an interactive 3D turntable in a Next.js application. The turntable requires smooth animations (spinning platter, tonearm pivot), interaction handling (needle drop gesture), and integration with the YouTube audio system.

**Target Requirements:**
- Next.js 16+ with App Router
- SSR/SSG compatibility (loading page may be pre-rendered)
- Bundle size budget: < 500KB for 3D dependencies
- 60fps animation on mobile devices
- Tonearm drag/click interaction for needle drop
- Integration with React state and YouTube player API

---

## Option 1: Three.js (Vanilla)

| Attribute | Details |
|-----------|---------|
| **Package** | `three` |
| **Version** | 0.160+ |
| **Bundle Size** | ~600KB (core library only) |
| **Gzipped** | ~150KB |
| **Learning Curve** | Steep — requires WebGL/GLSL knowledge |
| **Documentation** | https://threejs.org/docs/ |

### Code Example: Turntable Scene

```typescript
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface TurntableSceneProps {
  onNeedleDrop: () => void;
}

export function TurntableScene({ onNeedleDrop }: TurntableSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const tonearmRef = useRef<THREE.Group | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // Turntable base
    const baseGeometry = new THREE.BoxGeometry(4, 0.5, 3);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.25;
    scene.add(base);

    // Spinning platter
    const platterGeometry = new THREE.CylinderGeometry(1.8, 1.8, 0.1, 64);
    const platterMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
    const platter = new THREE.Mesh(platterGeometry, platterMaterial);
    platter.position.y = 0.6;
    scene.add(platter);

    // Animation loop for platter
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      platter.rotation.y += 0.02; // Spin at ~33 RPM visual
      renderer.render(scene, camera);
    };
    animate();

    // Tonearm group for pivot
    const tonearmGroup = new THREE.Group();
    tonearmGroup.position.set(1.5, 0.6, -1);
    scene.add(tonearmGroup);
    tonearmRef.current = tonearmGroup;

    // Tonearm mesh
    const armGeometry = new THREE.BoxGeometry(0.1, 0.1, 2.5);
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.z = 1;
    tonearmGroup.add(arm);

    // Raycaster for interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseDown = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(tonearmGroup.children);
      
      if (intersects.length > 0) {
        isDragging.current = true;
      }
    };

    const onMouseUp = () => {
      if (isDragging.current && tonearmRef.current) {
        // Check if needle is over record (dropped position)
        const rotation = tonearmRef.current.rotation.y;
        if (rotation > 0.3 && rotation < 0.5) {
          onNeedleDrop();
        }
      }
      isDragging.current = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isDragging.current || !tonearmRef.current) return;
      
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      // Pivot tonearm based on mouse position
      const targetRotation = (mouse.x + 1) * 0.4;
      tonearmRef.current.rotation.y = Math.max(0, Math.min(0.6, targetRotation));
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [onNeedleDrop]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

### Pros
- **Full Control** — Direct WebGL access, no abstraction overhead
- **Mature Ecosystem** — Largest community, extensive examples
- **Performance** — No React reconciliation overhead for animations
- **Flexibility** — Can optimize every aspect of rendering

### Cons
- **Bundle Size** — 600KB+ core library, exceeds budget alone
- **Learning Curve** — Requires understanding of WebGL, matrices, shaders
- **React Integration** — Manual imperative code, harder to sync with React state
- **SSR Complexity** — Must use `'use client'`, no server rendering
- **Boilerplate** — Verbose setup code for scenes, lights, cameras
- **Memory Management** — Manual disposal of geometries, materials, textures

### Risk Assessment
| Risk | Severity | Mitigation |
|------|----------|------------|
| Bundle bloat | High | Tree-shaking limited, consider CDN import |
| SSR issues | Medium | Force client-only, add loading state |
| Dev velocity | Medium | Steep learning curve for team |
| Memory leaks | Medium | Careful cleanup in useEffect |

---

## Option 2: React Three Fiber (@react-three/fiber)

| Attribute | Details |
|-----------|---------|
| **Package** | `@react-three/fiber` + `@react-three/drei` |
| **Version** | 8.15+ (R3F), 9.92+ (Drei) |
| **Bundle Size** | ~150KB (R3F) + ~200KB (Drei) |
| **Gzipped** | ~40KB + ~50KB |
| **Learning Curve** | Moderate — React patterns, some Three.js knowledge |
| **Documentation** | https://docs.pmnd.rs/react-three-fiber |

### Code Example: Turntable Scene

```typescript
'use client';

import { useRef, useState } from 'react';
import { Canvas, useFrame, ThreeElements } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface PlatterProps {
  isPlaying: boolean;
}

function Platter({ isPlaying }: PlatterProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((_, delta) => {
    if (meshRef.current && isPlaying) {
      meshRef.current.rotation.y += delta * 2; // 33 RPM simulation
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0.6, 0]}>
      <cylinderGeometry args={[1.8, 1.8, 0.1, 64]} />
      <meshStandardMaterial color="#0a0a0a" roughness={0.3} metalness={0.2} />
    </mesh>
  );
}

interface TonearmProps {
  onDrop: () => void;
}

function Tonearm({ onDrop }: TonearmProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [dropped, setDropped] = useState(false);

  const handlePointerDown = () => {
    setDropped(true);
    // Animate to dropped position
    if (groupRef.current) {
      groupRef.current.rotation.y = 0.4;
    }
    onDrop();
  };

  return (
    <group ref={groupRef} position={[1.5, 0.6, -1]}>
      <mesh
        onPointerDown={handlePointerDown}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <boxGeometry args={[0.1, 0.1, 2.5]} />
        <meshStandardMaterial 
          color={hovered ? '#aaaaaa' : '#888888'} 
          roughness={0.4}
          metalness={0.8}
        />
      </mesh>
      {/* Pivot point visual */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  );
}

function TurntableBase() {
  return (
    <mesh position={[0, 0.25, 0]}>
      <boxGeometry args={[4, 0.5, 3]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
    </mesh>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 7]} intensity={1} />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#4444ff" />
    </>
  );
}

interface TurntableSceneProps {
  onNeedleDrop: () => void;
}

export function TurntableScene({ onNeedleDrop }: TurntableSceneProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleDrop = () => {
    setIsPlaying(true);
    onNeedleDrop();
  };

  return (
    <div className="w-full h-screen">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={45} />
        <OrbitControls 
          enablePan={false} 
          enableZoom={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.5}
        />
        <Lights />
        <TurntableBase />
        <Platter isPlaying={isPlaying} />
        <Tonearm onDrop={handleDrop} />
      </Canvas>
    </div>
  );
}

// Usage with GLTF model (if using external model)
function TurntableWithModel({ onNeedleDrop }: TurntableSceneProps) {
  const { scene } = useGLTF('/models/turntable.glb');
  
  return (
    <div className="w-full h-screen">
      <Canvas>
        <PerspectiveCamera makeDefault position={[3, 3, 3]} />
        <Lights />
        <primitive 
          object={scene} 
          onClick={onNeedleDrop}
          scale={0.5}
        />
      </Canvas>
    </div>
  );
}
```

### Pros
- **React Native** — Declarative JSX components, React state integration
- **Bundle Efficient** — ~350KB total (vs 600KB+ vanilla)
- **Drei Ecosystem** — Pre-built helpers: OrbitControls, useGLTF, animations
- **useFrame Hook** — Animation loop integrated with React lifecycle
- **Performance** — Automatic optimization, instanced rendering support
- **TypeScript** — Full type support for Three.js objects

### Cons
- **Abstraction Layer** — Some Three.js features require escape hatches
- **SSR Challenges** — Still requires `'use client'`, no SSR benefits
- **Memory Management** — Some automatic cleanup, but careful with useLoader
- **Bundle Still Sizeable** — 350KB may be significant for loading page

### Risk Assessment
| Risk | Severity | Mitigation |
|------|----------|------------|
| Bundle size | Medium | Code-split, lazy load component |
| SSR issues | Medium | Client-only with Suspense fallback |
| Learning curve | Low | Familiar React patterns |
| Mobile performance | Low | R3F optimized for mobile |

---

## Option 3: Spline

| Attribute | Details |
|-----------|---------|
| **Package** | `@splinetool/react-spline` + `@splinetool/runtime` |
| **Version** | 2.2+ |
| **Bundle Size** | ~280KB (runtime) |
| **Gzipped** | ~80KB |
| **Learning Curve** | Low — visual editor, minimal code |
| **Documentation** | https://docs.spline.design/ |
| **Pricing** | Free tier (personal) / $7/mo Pro |

### Code Example: Turntable Scene

```typescript
'use client';

import { useRef } from 'react';
import Spline, { SplineEvent } from '@splinetool/react-spline';
import { Application } from '@splinetool/runtime';

interface TurntableSceneProps {
  onNeedleDrop: () => void;
}

export function TurntableScene({ onNeedleDrop }: TurntableSceneProps) {
  const splineRef = useRef<Application>(null);

  const onLoad = (spline: Application) => {
    splineRef.current = spline;
    
    // Set up initial state
    spline.setVariable('isPlaying', false);
    
    // Subscribe to Spline events (defined in Spline editor)
    spline.addEventListener('needleDrop', () => {
      onNeedleDrop();
      spline.setVariable('isPlaying', true);
      
      // Trigger animation state in Spline
      spline.emitEvent('startPlayback');
    });
  };

  const onMouseDown = (e: SplineEvent) => {
    // Handle specific object clicks
    if (e.target.name === 'tonearm') {
      console.log('Tonearm clicked');
    }
  };

  return (
    <div className="w-full h-screen relative">
      <Spline
        scene="https://prod.spline.design/abc123/turntable.splinecode"
        onLoad={onLoad}
        onMouseDown={onMouseDown}
      />
      
      {/* Overlay UI can still be React */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
        <p className="text-sm text-gray-400">Drag the tonearm to drop the needle</p>
      </div>
    </div>
  );
}

// Alternative: Self-hosted Spline export
import splineScene from './turntable.splinecode';

export function TurntableSceneSelfHosted({ onNeedleDrop }: TurntableSceneProps) {
  return (
    <div className="w-full h-screen">
      <Spline
        scene={splineScene}
        onLoad={(spline) => {
          // Set up event listeners
          spline.addEventListener('needleDrop', onNeedleDrop);
        }}
      />
    </div>
  );
}
```

### Spline Editor Setup (for reference)

```
1. Create new scene in Spline (spline.design)
2. Build simplified turntable:
   - Box for base (4:3 ratio, black material)
   - Cylinder for platter (circular, black, slight metallic)
   - Group for tonearm with pivot point
   - Record disc with label texture
3. Add interactions:
   - State variable: isPlaying (boolean)
   - Event: needleDrop (triggered on tonearm drag/click)
   - Animation: tonearm rotation 0° → 25° on needleDrop
   - Animation: platter rotation continuous when isPlaying=true
4. Export settings:
   - Format: Spline Runtime (React)
   - Enable "Export for production"
   - Copy scene URL or download .splinecode file
```

### Pros
- **Visual Editor** — Design in browser, no code for 3D assets
- **Smallest Code** — ~280KB runtime, minimal implementation code
- **Sketch Aesthetic** — Native support for stylized, non-photorealistic look
- **Built-in Interactions** — Drag, click, hover states defined visually
- **Event System** — Bidirectional communication between Spline and React
- **Performance** — Optimized runtime, efficient on mobile
- **Rapid Iteration** — Designer can modify without code changes

### Cons
- **External Dependency** — Relies on Spline service (or self-hosted file)
- **Limited Programmatic Control** — Complex logic may need workarounds
- **Animation Constraints** — Physics/rigging less flexible than raw Three.js
- **Team Dependency** — Requires Spline editor access for modifications
- **Pro Features** — Some export options require paid tier

### Risk Assessment
| Risk | Severity | Mitigation |
|------|----------|------------|
| Service dependency | Medium | Self-host .splinecode file |
| Vendor lock-in | Medium | Export to GLB if needed (limited) |
| Custom animation limits | Low | Sufficient for turntable needs |
| Team workflow | Low | Designer + developer collaboration |

---

## Comparison Matrix

| Criteria | Three.js Vanilla | React Three Fiber | Spline |
|----------|------------------|-------------------|--------|
| **Bundle Size** | ❌ ~600KB | ⚠️ ~350KB | ✅ ~280KB |
| **Next.js App Router** | ⚠️ Client only | ⚠️ Client only | ⚠️ Client only |
| **SSR/SSG Support** | ❌ None | ❌ None | ❌ None |
| **Animation Support** | ✅ Full control | ✅ useFrame hook | ✅ Built-in states |
| **Mobile Performance** | ⚠️ Manual optimization | ✅ R3F optimized | ✅ Spline optimized |
| **Developer Experience** | ❌ Verbose, imperative | ✅ React-native | ✅ Visual editor |
| **Tonearm Pivot** | ✅ Manual calculation | ✅ React state | ✅ Visual rigging |
| **Sketch Aesthetic** | ⚠️ Manual shaders | ⚠️ Material config | ✅ Native support |
| **Learning Curve** | ❌ Steep | ⚠️ Moderate | ✅ Low |
| **Iteration Speed** | ❌ Slow | ⚠️ Medium | ✅ Fast (visual) |
| **TypeScript Support** | ✅ Full | ✅ Full | ✅ Full |
| **Ecosystem** | ✅ Largest | ✅ Growing | ⚠️ Spline-specific |
| **Cost** | ✅ Free | ✅ Free | ⚠️ Free/$7mo |

### Rating Scale (1-5)

| Technology | Bundle | DX | Mobile | Animation | Total |
|------------|--------|-----|--------|-----------|-------|
| Three.js | 2/5 | 2/5 | 3/5 | 5/5 | 12/20 |
| React Three Fiber | 3/5 | 4/5 | 4/5 | 4/5 | 15/20 |
| Spline | 4/5 | 5/5 | 4/5 | 4/5 | 17/20 |

---

## Final Recommendation

### Primary Recommendation: **Spline**

**Rationale:**

1. **Aesthetic Alignment** — The spec explicitly calls for "sketch aesthetic, designed in Aura.build." Spline's design-first approach is purpose-built for this stylized look. Photorealistic rendering (Three.js/R3F default) works against the design direction.

2. **Fastest Implementation** — Visual editor + minimal code = fastest path to MVP. The tonearm drag interaction can be prototyped in minutes, not hours.

3. **Smallest Bundle** — ~280KB runtime is the smallest of all options, critical for a loading page where every KB matters.

4. **Built-in Interactions** — Needle drop mechanic is drag-and-drop in Spline's editor. No manual raycasting, pivot calculations, or animation loops required.

5. **Designer/Developer Split** — Designer owns the visual asset in Spline, developer handles React integration. Clean separation of concerns.

**Implementation Path:**
1. Create turntable scene in Spline (base, platter, tonearm, record)
2. Define `needleDrop` event in Spline editor (tonearm drag/click trigger)
3. Export as React component
4. Integrate with YouTube player:
   ```typescript
   spline.addEventListener('needleDrop', () => {
     player.playVideo();
     transitionToPortfolio();
   });
   ```
5. Self-host `.splinecode` file to avoid external dependency

### Fallback Recommendation: **React Three Fiber**

If Spline proves insufficient (complex custom physics, need full shader control):

1. Use `@react-three/fiber` with `@react-three/drei`
2. Build procedural turntable using R3F primitives
3. Tonearm animation via `useFrame` + React state
4. Code-split the component:
   ```typescript
   const TurntableScene = dynamic(
     () => import('./TurntableScene'),
     { ssr: false, loading: () => <LoadingSpinner /> }
   );
   ```

### Not Recommended: **Vanilla Three.js**

The bundle size (~600KB), verbose API, and React integration friction make this unsuitable for a loading page that should prioritize fast load times and clean code.

---

## Migration Path

If starting with Spline and needing to migrate to R3F later:

1. **Export from Spline** — Use File → Export → GLB to get geometry
2. **Import to R3F** — Use `useGLTF('/models/turntable.glb')`
3. **Recreate interactions** — Convert Spline events to R3F `onPointerDown` handlers
4. **Migrate animations** — Convert Spline state animations to `useFrame` loops

Estimated migration effort: 1-2 days for turntable complexity.

---

## Appendix: Additional Considerations

### Next.js Specifics

All three options require `'use client'` directive because WebGL requires browser APIs. For loading page:

```typescript
// app/loading/page.tsx
import dynamic from 'next/dynamic';

const TurntableLoader = dynamic(
  () => import('@/components/TurntableLoader'),
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-black h-screen" />
  }
);

export default function LoadingPage() {
  return <TurntableLoader />;
}
```

### Performance Budget Impact

| Approach | JS Bundle | 3D Runtime | Total |
|----------|-----------|------------|-------|
| Current (no 3D) | ~150KB | — | ~150KB |
| + Three.js | ~150KB | ~600KB | ~750KB |
| + React Three Fiber | ~150KB | ~350KB | ~500KB |
| + Spline | ~150KB | ~280KB | ~430KB |

**Target loading page budget:** < 500KB total JS
- Spline fits comfortably
- R3F is borderline (requires code-splitting)
- Vanilla Three.js exceeds budget

### prefers-reduced-motion

All options can respect reduced motion:

```typescript
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

// Spline
spline.setVariable('enableAnimations', !prefersReducedMotion);

// R3F / Three.js
<Platter isPlaying={isPlaying && !prefersReducedMotion} />
```

---

*Document Version: 1.0*
*Author: Developer Agent*
*Date: February 10, 2026*
