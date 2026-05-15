'use client';

import { useEffect, useState } from 'react';
import { useAIProgressStore } from '@/stores/ai-progress-store';

export function AIProgressLine() {
  const { progressPercentage, activeTask } = useAIProgressStore();
  const [displayProgress, setDisplayProgress] = useState(0);
  const [shimmerPos, setShimmerPos] = useState(0);

  // Smooth progress animation
  useEffect(() => {
    if (!activeTask) {
      setDisplayProgress(0);
      return;
    }

    // Staged progress simulation: slowly increase toward the target
    // This creates a natural "thinking" feel without jumping around
    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        const target = progressPercentage;
        const diff = target - prev;

        // If target is higher, accelerate toward it
        // If target is lower, quickly drop
        if (diff > 0) {
          // Logarithmic easing for natural progression
          return prev + diff * 0.12 + 0.1;
        } else {
          // Quick drop if progress regresses
          return prev + diff * 0.25;
        }
      });
    }, 60);

    return () => clearInterval(interval);
  }, [progressPercentage, activeTask]);

  // Shimmer animation
  useEffect(() => {
    const interval = setInterval(() => {
      setShimmerPos((prev) => (prev + 1) % 100);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const isActive = activeTask && displayProgress > 2;

  return (
    <div className="absolute top-0 left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-teal-500/20 to-transparent">
      {/* Base progress line */}
      <div
        className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full transition-all duration-150 ease-out"
        style={{
          width: `${Math.min(displayProgress, 99)}%`,
          opacity: isActive ? 0.9 : 0.6,
        }}
      >
        {/* Shimmer effect overlay */}
        {isActive && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
              backgroundSize: '200% 100%',
              backgroundPosition: `${shimmerPos * 2}% 0`,
              opacity: 0.6,
            }}
          />
        )}
      </div>

      {/* Subtle glow beneath line */}
      {isActive && (
        <div
          className="absolute top-full left-0 h-1 rounded-full blur-sm"
          style={{
            width: `${Math.min(displayProgress, 99)}%`,
            background: 'rgba(45, 212, 191, 0.3)',
            opacity: 0.5,
          }}
        />
      )}
    </div>
  );
}
