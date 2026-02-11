'use client';

import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';

// ── R3F scene (client-only; mount via next/dynamic with ssr: false) ─────

function TurntableBase() {
  return (
    <mesh position={[0, -0.5, 0]}>
      <boxGeometry args={[4.5, 0.3, 3.5]} />
      <meshStandardMaterial color="#c4b9a8" roughness={0.3} metalness={0.1} />
    </mesh>
  );
}

function Platter({ isPlaying }: { isPlaying: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current && isPlaying) {
      meshRef.current.rotation.y += delta * 3;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, -0.25, 0]}>
      <cylinderGeometry args={[1.7, 1.7, 0.1, 64]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.3} />
    </mesh>
  );
}

function RecordLabel() {
  return (
    <mesh position={[0, -0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.6, 32]} />
      <meshStandardMaterial color="#000000" />
    </mesh>
  );
}

function Spindle() {
  return (
    <mesh position={[0, -0.15, 0]}>
      <cylinderGeometry args={[0.03, 0.03, 0.1, 16]} />
      <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

interface TonearmProps {
  onDrop: () => void;
  isDropped: boolean;
}

function Tonearm({ onDrop, isDropped }: TonearmProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!groupRef.current || !isDropped) return;
    const targetRotation = 0.35;
    const startRotation = 0;
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (groupRef.current) {
        groupRef.current.rotation.y = startRotation + (targetRotation - startRotation) * eased;
      }
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [isDropped]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!isDropped) onDrop();
  };

  return (
    <group position={[1.8, -0.15, -1.2]}>
      <mesh>
        <cylinderGeometry args={[0.25, 0.25, 0.15, 32]} />
        <meshStandardMaterial color="#d4c4b0" metalness={0.3} roughness={0.4} />
      </mesh>
      <group ref={groupRef}>
        <mesh
          position={[0, 0.05, 1.1]}
          onPointerDown={handlePointerDown}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          <boxGeometry args={[0.08, 0.06, 2.2]} />
          <meshStandardMaterial
            color={hovered ? '#e8d4b8' : '#d4c4b0'}
            metalness={0.5}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, 0.05, 2.3]} rotation={[0, 0.35, 0]}>
          <boxGeometry args={[0.12, 0.08, 0.4]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.2} roughness={0.6} />
        </mesh>
        <mesh position={[0.05, -0.05, 2.45]} rotation={[0, 0.35, 0]}>
          <coneGeometry args={[0.02, 0.1, 8]} />
          <meshStandardMaterial color="#ffffff" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
      <mesh
        position={[0, 0.2, 1.1]}
        onPointerDown={handlePointerDown}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        visible={false}
      >
        <boxGeometry args={[0.5, 0.5, 3]} />
      </mesh>
    </group>
  );
}

interface SceneContentProps {
  onNeedleDrop: () => void;
  isPlaying: boolean;
}

function SceneContent({ onNeedleDrop, isPlaying }: SceneContentProps) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[4, 5, 5]} fov={35} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 7]} intensity={1.2} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={0.4} color="#4444ff" />
      <TurntableBase />
      <Platter isPlaying={isPlaying} />
      <RecordLabel />
      <Spindle />
      <Tonearm onDrop={onNeedleDrop} isDropped={isPlaying} />
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
