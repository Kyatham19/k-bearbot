'use client';

import { useEffect, useState } from 'react';
import { useAIProgressStore } from '@/stores/ai-progress-store';
import { AIProgressLine } from './ai-progress-line';
import { AIProgressCollapsed } from './ai-progress-collapsed';
import { AIProgressExpanded } from './ai-progress-expanded';

export function AIProgressIndicator() {
  const { activeTask, completedTasks, isExpanded, setExpanded, scheduleAutoCollapse, cancelAutoCollapse } =
    useAIProgressStore();
  const [ellipsis, setEllipsis] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Smooth ellipsis animation (1, 2, or 3 dots)
  useEffect(() => {
    if (!activeTask) return;
    const timer = setInterval(() => setEllipsis((e) => (e + 1) % 3), 600);
    return () => clearInterval(timer);
  }, [activeTask]);

  if (!activeTask || !mounted) return null;

  const show = completedTasks.length > 0 && isExpanded;
  const expandedHeight = Math.min(56 + completedTasks.length * 28, 280);

  return (
    <div
      className="fixed bottom-5 right-5 z-50 md:bottom-6 md:right-6"
      onMouseEnter={() => {
        cancelAutoCollapse();
        setExpanded(true);
      }}
      onMouseLeave={() => {
        setExpanded(false);
        scheduleAutoCollapse();
      }}
      onClick={() => {
        setExpanded(!isExpanded);
      }}
      role="region"
      aria-live="polite"
      aria-label="AI processing status"
    >
      {/* Glassmorphic container */}
      <div
        className="relative rounded-2xl overflow-hidden backdrop-blur-xl transition-all duration-300 ease-out cursor-pointer"
        style={{
          background: 'rgba(18, 18, 18, 0.72)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          height: show ? `${expandedHeight}px` : '48px',
          minWidth: show ? '280px' : 'auto',
          maxHeight: show ? '320px' : '48px',
        }}
      >
        {/* Progress line at top */}
        <AIProgressLine />

        {/* Content with fade transition */}
        <div className="relative overflow-hidden h-full">
          {show ? (
            <div className="animate-in fade-in duration-200">
              <AIProgressExpanded tasks={completedTasks} activeTask={activeTask} />
            </div>
          ) : (
            <div className="animate-in fade-in duration-200">
              <AIProgressCollapsed taskName={activeTask.name} ellipsis={ellipsis} />
            </div>
          )}
        </div>
      </div>

      {/* Subtle ambient glow (very subtle, no flashiness) */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at top right, rgba(45, 212, 191, 0.1), transparent)',
        }}
      />
    </div>
  );
}
