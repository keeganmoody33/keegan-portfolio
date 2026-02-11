'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// Types
declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: YTPlayerOptions) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  getVolume(): number;
  destroy(): void;
}

interface YTPlayerOptions {
  videoId?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
  };
}

// Playlist ID from spec
const PLAYLIST_ID = 'PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk';
const HAS_VISITED_KEY = 'hasVisitedPortfolio';
const AUDIO_STATE_KEY = 'portfolio_audio_state';

// YouTube Player Hook
function useYouTubePlayer() {
  const playerRef = useRef<YTPlayer | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('yt-player-hidden', {
        playerVars: {
          listType: 'playlist',
          list: PLAYLIST_ID,
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => setIsReady(true),
        },
      });
    };

    return () => {
      playerRef.current?.destroy();
    };
  }, []);

  const play = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.playVideo();
    }
  }, []);

  const saveState = useCallback(() => {
    if (playerRef.current) {
      const state = {
        isPlaying: true,
        currentTime: playerRef.current.getCurrentTime(),
        volume: playerRef.current.getVolume(),
        timestamp: Date.now(),
      };
      sessionStorage.setItem(AUDIO_STATE_KEY, JSON.stringify(state));
    }
  }, []);

  return { player: playerRef.current, isReady, play, saveState };
}

// Turntable Base Component
function TurntableBase() {
  return (
    <mesh position={[0, -0.5, 0]}>
      <boxGeometry args={[4.5, 0.3, 3.5]} />
      <meshStandardMaterial color="#c4b9a8" roughness={0.3} metalness={0.1} />
    </mesh>
  );
}

// Platter Component
function Platter({ isPlaying }: { isPlaying: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current && isPlaying) {
      meshRef.current.rotation.y += delta * 3; // ~33 RPM feel
    }
  });

  return (
    <mesh ref={meshRef} position={[0, -0.25, 0]}>
      <cylinderGeometry args={[1.7, 1.7, 0.1, 64]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.3} />
    </mesh>
  );
}

// Record Label Component
function RecordLabel() {
  return (
    <mesh position={[0, -0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.6, 32]} />
      <meshStandardMaterial color="#000000" />
    </mesh>
  );
}

// Spindle Component
function Spindle() {
  return (
    <mesh position={[0, -0.15, 0]}>
      <cylinderGeometry args={[0.03, 0.03, 0.1, 16]} />
      <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

// Tonearm Component
interface TonearmProps {
  onDrop: () => void;
  isDropped: boolean;
}

function Tonearm({ onDrop, isDropped }: TonearmProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();

  // Animate tonearm drop
  useEffect(() => {
    if (groupRef.current && isDropped) {
      const targetRotation = 0.35; // Rotated inward toward record edge
      const startRotation = 0;
      const duration = 800;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        if (groupRef.current) {
          groupRef.current.rotation.y = startRotation + (targetRotation - startRotation) * eased;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }
  }, [isDropped]);

  const handlePointerDown = (e: THREE.Event<PointerEvent>) => {
    e.stopPropagation();
    if (!isDropped) {
      onDrop();
    }
  };

  return (
    <group position={[1.8, -0.15, -1.2]}>
      {/* Pivot base */}
      <mesh>
        <cylinderGeometry args={[0.25, 0.25, 0.15, 32]} />
        <meshStandardMaterial color="#d4c4b0" metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Rotating tonearm group */}
      <group ref={groupRef}>
        {/* Main arm */}
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

        {/* Headshell */}
        <mesh position={[0, 0.05, 2.3]} rotation={[0, 0.35, 0]}>
          <boxGeometry args={[0.12, 0.08, 0.4]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.2} roughness={0.6} />
        </mesh>

        {/* Needle */}
        <mesh position={[0.05, -0.05, 2.45]} rotation={[0, 0.35, 0]}>
          <coneGeometry args={[0.02, 0.1, 8]} />
          <meshStandardMaterial color="#ffffff" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      {/* Click target (invisible, larger) */}
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

// Scene Component
interface SceneProps {
  onNeedleDrop: () => void;
  isPlaying: boolean;
}

function Scene({ onNeedleDrop, isPlaying }: SceneProps) {
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

// Static Transition Effect
function StaticTransition({ isActive }: { isActive: boolean }) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 pointer-events-none"
          style={{
            background: `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(255,255,255,0.1) 2px,
                rgba(255,255,255,0.1) 4px
              ),
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 2px,
                rgba(0,0,0,0.1) 2px,
                rgba(0,0,0,0.1) 4px
              )
            `,
          }}
        >
          <motion.div
            animate={{
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 0.1,
              repeat: Infinity,
            }}
            className="absolute inset-0 bg-black/40"
          />
          {/* Scanlines */}
          <div className="absolute inset-0 opacity-30">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-full h-px bg-white/20"
                animate={{
                  top: ['0%', '100%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'linear',
                }}
                style={{ top: `${i * 5}%` }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Main Loading Page Component
export default function TurntableLoadingPage() {
  const router = useRouter();
  const { isReady, play, saveState } = useYouTubePlayer();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Check for return visitor
  useEffect(() => {
    const hasVisited = localStorage.getItem(HAS_VISITED_KEY);
    if (hasVisited) {
      router.replace('/');
    } else {
      // Show skip button after 3 seconds
      const timer = setTimeout(() => setShowSkip(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [router]);

  // Check for reduced motion preference
  const prefersReducedMotion = 
    typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <button
          onClick={() => {
            localStorage.setItem(HAS_VISITED_KEY, 'true');
            router.push('/');
          }}
          className="px-8 py-4 bg-white text-black font-medium rounded"
        >
          Enter Portfolio
        </button>
      </div>
    );
  }

  const handleNeedleDrop = () => {
    if (!isReady || isPlaying) return;

    // SYNCHRONOUS: Play audio immediately within user gesture
    play();
    setIsPlaying(true);

    // Delay before transition
    setTimeout(() => {
      setIsTransitioning(true);
      saveState();
      localStorage.setItem(HAS_VISITED_KEY, 'true');

      // Static glitch transition
      setTimeout(() => {
        router.push('/');
      }, 1500);
    }, 2000);
  };

  const handleSkip = () => {
    localStorage.setItem(HAS_VISITED_KEY, 'true');
    router.push('/');
  };

  return (
    <div 
      className="min-h-screen bg-neutral-900 relative overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hidden YouTube player */}
      <div id="yt-player-hidden" className="absolute opacity-0 pointer-events-none" />

      {/* 3D Scene */}
      <motion.div 
        className="absolute inset-0"
        animate={{
          scale: hovered && !isPlaying ? 1.02 : 1,
        }}
        transition={{ duration: 0.3 }}
      >
        <Canvas shadows gl={{ antialias: true }}>
          <Scene onNeedleDrop={handleNeedleDrop} isPlaying={isPlaying} />
        </Canvas>
      </motion.div>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Instructions */}
        {!isPlaying && !isTransitioning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 text-center"
          >
            <p className="text-white/60 text-sm tracking-widest uppercase">
              Click the tonearm to start
            </p>
          </motion.div>
        )}

        {/* Skip Button */}
        <AnimatePresence>
          {showSkip && !isPlaying && !isTransitioning && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleSkip}
              className="absolute bottom-8 right-8 text-xs text-white/30 hover:text-white/60 transition-colors pointer-events-auto"
            >
              I don&apos;t like music
            </motion.button>
          )}
        </AnimatePresence>

        {/* Loading state */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Static Transition */}
      <StaticTransition isActive={isTransitioning} />
    </div>
  );
}
