'use client';

import { useEffect, useState } from 'react';

export function useAudioHandoff() {
  const [audioState, setAudioState] = useState<{
    isPlaying: boolean;
    currentTime: number;
    volume: number;
  } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('portfolio_audio_state');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Check if state is fresh (within 5 minutes)
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          setAudioState({
            isPlaying: parsed.isPlaying,
            currentTime: parsed.currentTime,
            volume: parsed.volume,
          });
        }
      } catch {
        // Invalid state, ignore
      }
    }
  }, []);

  return audioState;
}
