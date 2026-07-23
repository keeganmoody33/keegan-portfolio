'use client';

import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// ── GLB turntable model ───────────────────────────────────────────────
// Exported from turntable.blend (procedural SL-1200 MK2 by sl1200_turntable.py)
// Mesh names: Base, Platter, PlatterDot_0-7, Slipmat, Record, RecordLabel,
// Spindle, TonearmBase, TonearmPost, Tonearm, Headshell, Stylus,
// PitchSlider, StartButton, PowerButton

const GLB_PATH = '/models/turntable.glb';

// Meshes that spin together when the record plays
const SPINNING_MESHES = new Set(['Platter', 'PlatterDot_0', 'PlatterDot_1', 'PlatterDot_2',
  'PlatterDot_3', 'PlatterDot_4', 'PlatterDot_5', 'PlatterDot_6', 'PlatterDot_7',
  'Slipmat', 'Record', 'RecordLabel', 'Spindle']);

// Meshes that pivot together when the tonearm drops
const TONEARM_MESHES = new Set(['Tonearm', 'Headshell', 'Stylus']);

// Meshes that are clickable to trigger the needle drop
const CLICKABLE_MESHES = new Set(['Tonearm', 'Headshell', 'Stylus', 'TonearmPost']);

// ── PBR Material Assignments (photoreal SL-1200 MK2) ────────────────────
// The GLB has flat white default materials because the Blender script uses
// legacy diffuse_color. Apply proper MeshStandardMaterial per named mesh.
interface MaterialSpec {
  color: number;
  roughness: number;
  metalness: number;
  emissive?: number;
  emissiveIntensity?: number;
  clearcoat?: number;
}

const MATERIAL_MAP: Record<string, MaterialSpec> = {
  // Chassis — matte black plastic
  Base: { color: 0x0a0a0a, roughness: 0.35, metalness: 0.05 },

  // Platter — brushed aluminum
  Platter: { color: 0xb0b0b0, roughness: 0.28, metalness: 0.85 },
  Spindle: { color: 0xd0d0d0, roughness: 0.2, metalness: 0.95 },

  // Slipmat — matte black felt
  Slipmat: { color: 0x0f0f0f, roughness: 0.95, metalness: 0 },

  // Record — high-gloss vinyl (clear-coated black)
  Record: { color: 0x050505, roughness: 0.15, metalness: 0, clearcoat: 1 },
  RecordLabel: { color: 0xcc4a17, roughness: 0.6, metalness: 0 }, // lecturesfrom orange

  // Tonearm — chrome
  TonearmBase: { color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 },
  TonearmPost: { color: 0xc8c8c8, roughness: 0.18, metalness: 0.95 },
  Tonearm: { color: 0xc8c8c8, roughness: 0.18, metalness: 0.95 },
  Headshell: { color: 0x1a1a1a, roughness: 0.3, metalness: 0.4 },
  Stylus: { color: 0x080808, roughness: 0.5, metalness: 0.2 },

  // Controls
  PitchSlider: { color: 0x2a2a2a, roughness: 0.5, metalness: 0.2 },
  StartButton: {
    color: 0xff2a1a,
    roughness: 0.3,
    metalness: 0,
    emissive: 0xff2a1a,
    emissiveIntensity: 0.6,
  },
  PowerButton: { color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 },
};

// Platter speed-indicator dots — apply a matching material to all 8
const PLATTER_DOT_MATERIAL: MaterialSpec = {
  color: 0xe0e0e0,
  roughness: 0.2,
  metalness: 0.9,
  emissive: 0x442200,
  emissiveIntensity: 0.4,
};

function materialForMeshName(name: string): MaterialSpec | null {
  if (MATERIAL_MAP[name]) return MATERIAL_MAP[name];
  if (name.startsWith('PlatterDot_')) return PLATTER_DOT_MATERIAL;
  return null;
}

function buildMaterial(spec: MaterialSpec): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
  if (spec.clearcoat !== undefined) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness,
      clearcoat: spec.clearcoat,
      clearcoatRoughness: 0.1,
    });
    if (spec.emissive !== undefined) {
      mat.emissive = new THREE.Color(spec.emissive);
      mat.emissiveIntensity = spec.emissiveIntensity ?? 1;
    }
    return mat;
  }
  const mat = new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: spec.roughness,
    metalness: spec.metalness,
  });
  if (spec.emissive !== undefined) {
    mat.emissive = new THREE.Color(spec.emissive);
    mat.emissiveIntensity = spec.emissiveIntensity ?? 1;
  }
  return mat;
}

interface PreparedScene {
  scene: THREE.Group;
  spinningGroup: THREE.Group;
  tonearmGroup: THREE.Group;
  clickableMeshes: THREE.Mesh[];
}

function prepareScene(source: THREE.Group): PreparedScene {
  const scene = source.clone(true);
  const spinningGroup = new THREE.Group();
  const tonearmGroup = new THREE.Group();
  const clickableMeshes: THREE.Mesh[] = [];

  // Collect meshes first; do NOT modify the scene graph while traversing.
  const toSpin: THREE.Mesh[] = [];
  const toTonearm: THREE.Mesh[] = [];

  scene.traverse((obj) => {
    if (obj.type !== 'Mesh') return;
    const mesh = obj as THREE.Mesh;

    // Assign photoreal PBR material based on mesh name.
    const spec = materialForMeshName(mesh.name);
    if (spec) {
      mesh.material = buildMaterial(spec);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

    if (SPINNING_MESHES.has(mesh.name)) {
      toSpin.push(mesh);
    } else if (TONEARM_MESHES.has(mesh.name)) {
      toTonearm.push(mesh);
      if (CLICKABLE_MESHES.has(mesh.name)) {
        clickableMeshes.push(mesh);
      }
    }
  });

  // Now re-parent the collected meshes into their animation groups.
  toSpin.forEach((mesh) => {
    mesh.updateMatrixWorld(true);
    spinningGroup.attach(mesh);
  });

  toTonearm.forEach((mesh) => {
    mesh.updateMatrixWorld(true);
    tonearmGroup.attach(mesh);
  });

  scene.add(spinningGroup);
  scene.add(tonearmGroup);

  return { scene, spinningGroup, tonearmGroup, clickableMeshes };
}

interface TurntableModelProps {
  onNeedleDrop: () => void;
  isPlaying: boolean;
}

function TurntableModel({ onNeedleDrop, isPlaying }: TurntableModelProps) {
  const { scene } = useGLTF(GLB_PATH);
  const [hovered, setHovered] = useState(false);

  // Prepare the scene once, before the first render.
  const { scene: root, spinningGroup, tonearmGroup, clickableMeshes } = useMemo(
    () => prepareScene(scene),
    [scene]
  );

  // Spin animation
  useFrame((_, delta) => {
    if (isPlaying) {
      spinningGroup.rotation.y += delta * 3;
    }
  });

  // Tonearm drop animation
  useEffect(() => {
    if (!isPlaying) return;
    const targetRotation = 0.35;
    const startRotation = 0;
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      tonearmGroup.rotation.y = startRotation + (targetRotation - startRotation) * eased;
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [isPlaying, tonearmGroup]);

  // Apply hover emissive to tonearm meshes
  useEffect(() => {
    tonearmGroup.traverse((obj) => {
      if (obj.type !== 'Mesh') return;
      const mesh = obj as THREE.Mesh;
      const material = mesh.material;
      if (!material) return;

      const applyEmissive = (mat: THREE.Material) => {
        const std = mat as THREE.MeshStandardMaterial;
        if (std.emissive) {
          std.emissive.setHex(hovered ? 0x332211 : 0x000000);
        }
      };

      if (Array.isArray(material)) {
        material.forEach(applyEmissive);
      } else {
        applyEmissive(material);
      }
    });
  }, [hovered, tonearmGroup]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!isClickableMesh(e.object)) return;
    e.stopPropagation();
    if (!isPlaying) onNeedleDrop();
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (!isClickableMesh(e.object)) return;
    e.stopPropagation();
    setHovered(true);
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = () => {
    setHovered(false);
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'auto';
    }
  };

  function isClickableMesh(object: THREE.Object3D): boolean {
    return object.type === 'Mesh' && clickableMeshes.includes(object as THREE.Mesh);
  }

  return (
    <primitive
      object={root}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  );
}

interface SceneContentProps {
  onNeedleDrop: () => void;
  isPlaying: boolean;
}

function SceneContent({ onNeedleDrop, isPlaying }: SceneContentProps) {
  return (
    <>
      {/* Low ambient so shadows read; HDR handles most of the fill. */}
      <ambientLight intensity={0.15} />

      {/* Key light — top-right, warm-white, sharp shadow */}
      <directionalLight
        position={[3, 4, 2]}
        intensity={2.2}
        color="#fff2e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0005}
      />

      {/* Cool rim light — back-left, kicks the chrome tonearm */}
      <directionalLight position={[-2, 1.5, -2]} intensity={0.8} color="#5566ff" />

      {/* Subtle blue underlight for a moody club feel */}
      <pointLight position={[-1, 0.2, 0.5]} intensity={0.4} color="#2244ff" distance={3} />

      <Suspense fallback={null}>
        <TurntableModel onNeedleDrop={onNeedleDrop} isPlaying={isPlaying} />
        <Environment files="/hdri/studio_small_03_1k.hdr" />
      </Suspense>

      {/* Ground plane for shadow catching */}
      <mesh
        position={[0, -0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[10, 10]} />
        <shadowMaterial opacity={0.5} />
      </mesh>
    </>
  );
}

export interface TurntableCanvasProps {
  onNeedleDrop: () => void;
  isPlaying: boolean;
}

export default function TurntableCanvas({ onNeedleDrop, isPlaying }: TurntableCanvasProps) {
  return (
    <Canvas shadows gl={{ antialias: true }} camera={{ position: [1, 0.7, 1.2], fov: 35 }}>
      <SceneContent onNeedleDrop={onNeedleDrop} isPlaying={isPlaying} />
    </Canvas>
  );
}

useGLTF.preload(GLB_PATH);
