'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
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

interface TurntableModelProps {
  onNeedleDrop: () => void;
  isPlaying: boolean;
}

function TurntableModel({ onNeedleDrop, isPlaying }: TurntableModelProps) {
  const { scene } = useGLTF(GLB_PATH);
  const [hovered, setHovered] = useState(false);

  // Clone scene so we don't mutate the cached original
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // Refs for animated parts
  const spinningRef = useRef<THREE.Group>(null);
  const tonearmRef = useRef<THREE.Group>(null);

  // Build groups from named meshes and tag clickable ones
  useEffect(() => {
    const spinningGroup = new THREE.Group();
    const tonearmGroup = new THREE.Group();

    cloned.traverse((obj) => {
      if (obj.type !== 'Mesh') return;
      const mesh = obj as THREE.Mesh;

      if (SPINNING_MESHES.has(mesh.name)) {
        mesh.updateMatrixWorld(true);
        spinningGroup.attach(mesh);
      } else if (TONEARM_MESHES.has(mesh.name)) {
        mesh.updateMatrixWorld(true);
        tonearmGroup.attach(mesh);
        if (CLICKABLE_MESHES.has(mesh.name)) {
          mesh.userData.clickable = true;
        }
      }
    });

    cloned.add(spinningGroup);
    cloned.add(tonearmGroup);

    spinningRef.current = spinningGroup;
    tonearmRef.current = tonearmGroup;
  }, [cloned]);

  // Spin animation
  useFrame((_, delta) => {
    if (spinningRef.current && isPlaying) {
      spinningRef.current.rotation.y += delta * 3;
    }
  });

  // Tonearm drop animation
  useEffect(() => {
    if (!tonearmRef.current || !isPlaying) return;
    const targetRotation = 0.35;
    const startRotation = 0;
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (tonearmRef.current) {
        tonearmRef.current.rotation.y = startRotation + (targetRotation - startRotation) * eased;
      }
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [isPlaying]);

  // Apply hover emissive to tonearm meshes
  useEffect(() => {
    cloned.traverse((obj) => {
      if (obj.type !== 'Mesh') return;
      const mesh = obj as THREE.Mesh;
      if (TONEARM_MESHES.has(mesh.name)) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissive.setHex(hovered ? 0x332211 : 0x000000);
        }
      }
    });
  }, [hovered, cloned]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!e.object.userData.clickable) return;
    e.stopPropagation();
    if (!isPlaying) onNeedleDrop();
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (!e.object.userData.clickable) return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  return (
    <primitive
      object={cloned}
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
      <PerspectiveCamera makeDefault position={[0.5, -0.5, 0.6]} fov={35} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[1, -1, 2]} intensity={1.5} castShadow />
      <pointLight position={[-1, 1, 0.5]} intensity={0.3} color="#4444ff" />
      <TurntableModel onNeedleDrop={onNeedleDrop} isPlaying={isPlaying} />
      <Environment preset="studio" />
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
