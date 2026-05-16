'use client';

import { useEffect, useState } from 'react';
import { useAIProgressStore } from '@/stores/ai-progress-store';

export function AIProgressLine() {
  const { progressPercentage, activeTask, completedTasks } = useAIProgressStore();
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    const shouldShowCompletedState = !activeTask && completedTasks.length > 0 && progressPercentage >= 100;
    if (!activeTask && !shouldShowCompletedState) {
      setDisplayProgress(0);
      return;
    }

    const targetProgress = shouldShowCompletedState ? 100 : progressPercentage;
    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        const target = Math.max(prev, targetProgress);
        if (Math.abs(target - prev) < 0.2) return target;
        return prev + (target - prev) * 0.11;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [progressPercentage, activeTask, completedTasks.length]);

  const isActive = Boolean(activeTask);
  const width = `${Math.min(displayProgress, 100)}%`;

  return (
    <div className="absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-transparent via-teal-500/20 to-transparent">
      <div
        className="relative h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-[width,opacity] duration-300 ease-out"
        style={{
          width,
          opacity: isActive ? 0.92 : 0.6,
        }}
      >
        {isActive && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(110deg, transparent 15%, rgba(255,255,255,0.28) 48%, transparent 82%)',
              backgroundSize: '200% 100%',
              animation: 'ai-progress-shimmer 3.6s linear infinite',
              opacity: 0.28,
            }}
          />
        )}
      </div>

      {isActive && (
        <div
          className="absolute left-0 top-full h-1 rounded-full blur-sm transition-[width,opacity] duration-300 ease-out"
          style={{
            width,
            background: 'rgba(45, 212, 191, 0.22)',
            opacity: 0.34,
          }}
        />
      )}
    </div>
  );
}
