'use client';

import { useEffect, useState } from 'react';
import { usePlayerStore } from '@/lib/store';

export default function AudioVisualizer() {
  const { isPlaying } = usePlayerStore();
  const [barHeights, setBarHeights] = useState<number[]>([]);

  // Initialize bars (8 bars for a nice visualizer)
  useEffect(() => {
    setBarHeights(Array(8).fill(2));
  }, []);

  // Animate bars when playing
  useEffect(() => {
    if (!isPlaying) {
      // Reset to flat when not playing
      setBarHeights(Array(8).fill(2));
      return;
    }

    const interval = setInterval(() => {
      setBarHeights(
        Array(8)
          .fill(0)
          .map(() => Math.random() * 60 + 10) // Random heights between 10-70px
      );
    }, 150); // Update every 150ms for smooth animation

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="flex items-end justify-center gap-1 h-16 px-4">
      {barHeights.map((height, index) => (
        <div
          key={index}
          className="w-1.5 rounded-full transition-all duration-150 ease-in-out"
          style={{
            height: `${height}px`,
            background: isPlaying
              ? `linear-gradient(to top, #ffd700, #ffb7c5, #e75480)`
              : 'rgba(255, 183, 197, 0.3)',
            boxShadow: isPlaying
              ? `0 0 ${height / 2}px rgba(255, 183, 197, 0.6), 0 0 ${height}px rgba(255, 215, 0, 0.4)`
              : 'none',
          }}
        />
      ))}
    </div>
  );
}
