'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// Canvas/R3F only on client to avoid SSR and React 19 scheduler issues
const TurntableCanvas = dynamic(() => import('./TurntableCanvas'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-neutral-900" aria-hidden />,
});

// Playlist ID from spec (YT types from types/youtube.d.ts)
const PLAYLIST_ID = 'PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk';
const HAS_VISITED_KEY = 'hasVisitedPortfolio';
// Must match YouTubePlayer.tsx / youtube-service SESSION_KEY for handoff
const SESSION_KEY = 'yt-player-state';

// YouTube Player Hook (uses YT from types/youtube.d.ts)
function useYouTubePlayer() {
  const playerRef = useRef<YT.Player | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
    if (typeof window.YT !== 'undefined' && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
    }

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
    const p = playerRef.current;
    if (!p) return;
    try {
      const data = p.getVideoData?.() ?? {};
      const state = {
        videoId: data.video_id ?? '',
        trackTitle: data.title ?? '',
        trackAuthor: data.author ?? '',
        position: p.getCurrentTime?.() ?? 0,
        duration: p.getDuration?.() ?? 0,
        playing: true,
        playlistIndex: p.getPlaylistIndex?.() ?? 0,
        volume: p.getVolume?.() ?? 50,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch {
      // player may not expose all methods yet
    }
  }, []);

  return { player: playerRef.current, isReady, play, saveState };
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
        <TurntableCanvas onNeedleDrop={handleNeedleDrop} isPlaying={isPlaying} />
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
