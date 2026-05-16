'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAIProgressStore } from '@/stores/ai-progress-store';
import { AIProgressLine } from './ai-progress-line';
import { AIProgressCollapsed } from './ai-progress-collapsed';
import { AIProgressExpanded } from './ai-progress-expanded';

export function AIProgressIndicator() {
  const {
    activeTask,
    completedTasks,
    searchSources,
    lastSourceDomain,
    isExpanded,
    setExpanded,
    scheduleAutoCollapse,
    cancelAutoCollapse,
  } = useAIProgressStore();
  const [mounted, setMounted] = useState(false);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [collapsedFade, setCollapsedFade] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const collapsedMessages = useMemo(() => {
    const items: string[] = [];
    if (activeTask) {
      items.push(activeTask.name.endsWith('...') ? activeTask.name : `${activeTask.name}...`);
    }
    if (lastSourceDomain) {
      items.push(`Checking ${lastSourceDomain}...`);
    }
    if (items.length === 0 && completedTasks.length > 0) {
      items.push('Finalizing response...');
    }
    if (items.length === 0) {
      items.push('Building response...');
    }
    return [...new Set(items)];
  }, [activeTask, completedTasks.length, lastSourceDomain]);

  useEffect(() => {
    setRotationIndex(0);
  }, [collapsedMessages]);

  useEffect(() => {
    if (collapsedMessages.length < 2) return;
    const timer = setInterval(() => {
      setCollapsedFade(false);
      setTimeout(() => {
        setRotationIndex((idx) => (idx + 1) % collapsedMessages.length);
        setCollapsedFade(true);
      }, 180);
    }, 2400);
    return () => clearInterval(timer);
  }, [collapsedMessages]);

  if (!mounted || (!activeTask && completedTasks.length === 0)) return null;

  const showExpanded = isExpanded && (completedTasks.length > 0 || searchSources.length > 0 || Boolean(activeTask));
  const estimatedSourceRows = Math.min(searchSources.length, 8) + (searchSources.length > 8 ? 1 : 0);
  const expandedHeight = Math.min(64 + completedTasks.length * 26 + estimatedSourceRows * 18 + 72, 330);
  const collapsedText = collapsedMessages[rotationIndex % collapsedMessages.length];

  return (
    <div
      className="fixed bottom-5 right-5 z-50 md:bottom-6 md:right-6"
      onMouseEnter={() => {
        cancelAutoCollapse();
        setExpanded(true);
      }}
      onMouseLeave={() => {
        setExpanded(false);
        if (activeTask) {
          scheduleAutoCollapse();
        }
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
        className="relative cursor-pointer overflow-hidden rounded-2xl backdrop-blur-xl transition-[height,min-width,max-height,transform,opacity] duration-300 ease-out"
        style={{
          background: 'rgba(18, 18, 18, 0.72)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          height: showExpanded ? `${expandedHeight}px` : '48px',
          minWidth: showExpanded ? '290px' : '272px',
          maxHeight: showExpanded ? '330px' : '48px',
          transform: showExpanded ? 'scale(1)' : 'scale(0.995)',
        }}
      >
        <AIProgressLine />

        <div className="relative h-full overflow-hidden">
          {showExpanded ? (
            <div className="animate-in fade-in duration-200">
              <AIProgressExpanded
                tasks={completedTasks}
                activeTask={activeTask}
                sources={searchSources}
                lastSourceDomain={lastSourceDomain}
              />
            </div>
          ) : (
            <div
              className="animate-in fade-in duration-200 transition-opacity duration-200 ease-out"
              style={{ opacity: collapsedFade ? 1 : 0.2 }}
            >
              <AIProgressCollapsed text={collapsedText} />
            </div>
          )}
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500"
        style={{
          background: 'radial-gradient(circle at top right, rgba(45, 212, 191, 0.1), transparent)',
        }}
      />
    </div>
  );
}
