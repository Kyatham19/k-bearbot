'use client';

import { useEffect, useState } from 'react';
import { AISearchSource, AITask } from '@/stores/ai-progress-store';

interface ExpandedProps {
  tasks: AITask[];
  activeTask: AITask | null;
  sources: AISearchSource[];
  lastSourceDomain: string | null;
}

export function AIProgressExpanded({ tasks, activeTask, sources, lastSourceDomain }: ExpandedProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time for active task
  useEffect(() => {
    if (!activeTask) return;

    const interval = setInterval(() => {
      setElapsedTime((Date.now() - activeTask.startTime) / 1000);
    }, 120);

    return () => clearInterval(interval);
  }, [activeTask]);

  const formatTime = (sec: number) => {
    if (sec < 1) return `${(sec * 1000).toFixed(0)}ms`;
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const minutes = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(1);
    return `${minutes}m ${secs}s`;
  };

  const visibleSources = sources.slice(0, 8);
  const hiddenSourcesCount = Math.max(0, sources.length - visibleSources.length);

  return (
    <div className="space-y-2 px-4 py-3">
      {tasks.length > 0 && (
        <div className="space-y-1.5">
          {tasks.map((task, idx) => (
            <div
              key={task.id}
              className="group flex items-center justify-between gap-2 transition-opacity duration-200"
              style={{ opacity: 0.78 - Math.min(idx * 0.05, 0.2) }}
            >
              <div className="min-w-0 flex items-center gap-2.5">
                <span className="text-teal-400 text-xs font-semibold flex-shrink-0">✓</span>
                <span className="truncate text-xs font-medium text-white/72 transition-colors duration-200 group-hover:text-white/86">
                  {task.name}
                </span>
              </div>
              <span className="flex-shrink-0 tabular-nums text-xs text-white/42">
                {task.duration ? formatTime(task.duration) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {tasks.length > 0 && activeTask && (
        <div className="my-1 h-px bg-gradient-to-r from-white/5 via-white/12 to-transparent" />
      )}

      {activeTask && (
        <div className="flex items-center justify-between gap-2 transition-opacity duration-300">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="relative flex-shrink-0">
              <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
            </div>
            <span className="truncate text-xs font-medium text-white/86">{activeTask.name}</span>
          </div>
          <span className="flex-shrink-0 tabular-nums text-xs text-white/42">
            {formatTime(elapsedTime)}
          </span>
        </div>
      )}

      {visibleSources.length > 0 && (
        <>
          <div className="my-1 h-px bg-gradient-to-r from-white/5 via-white/10 to-transparent" />
          <div className="space-y-1">
            <div className="text-[11px] font-medium tracking-wide text-white/48">Sources searched</div>
            <div className="space-y-0.5">
              {visibleSources.map((source) => (
                <div
                  key={source.domain}
                  className="animate-in fade-in text-xs duration-300 transition-opacity ease-out"
                  style={{ opacity: source.domain === lastSourceDomain ? 0.9 : 0.6 }}
                >
                  {source.domain}
                </div>
              ))}
              {hiddenSourcesCount > 0 && (
                <div className="text-xs text-white/48">+{hiddenSourcesCount} more</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
