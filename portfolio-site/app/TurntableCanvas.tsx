'use client';

import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { PerspectiveCamera, Environment, useGLTF } from '@react-three/drei';
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
      <PerspectiveCamera makeDefault position={[2, 1.5, 2]} fov={45} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[1, -1, 2]} intensity={1.5} castShadow />
      <pointLight position={[-1, 1, 0.5]} intensity={0.3} color="#4444ff" />
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color="red" />
      </mesh>
      <Suspense fallback={null}>
        <TurntableModel onNeedleDrop={onNeedleDrop} isPlaying={isPlaying} />
        <Environment files="/hdri/studio_small_03_1k.hdr" />
      </Suspense>
    </>
  );
}

export interface TurntableCanvasProps {
  onNeedleDrop: () => void;
  isPlaying: boolean;
}

export default function TurntableCanvas({ onNeedleDrop, isPlaying }: TurntableCanvasProps) {
  return (
    <Canvas shadows gl={{ antialias: true }}>
      <SceneContent onNeedleDrop={onNeedleDrop} isPlaying={isPlaying} />
    </Canvas>
  );
}

useGLTF.preload(GLB_PATH);
