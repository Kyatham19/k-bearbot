'use client';

import { useEffect, useState } from 'react';
import { AITask } from '@/stores/ai-progress-store';

interface ExpandedProps {
  tasks: AITask[];
  activeTask: AITask | null;
}

export function AIProgressExpanded({ tasks, activeTask }: ExpandedProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time for active task
  useEffect(() => {
    if (!activeTask) return;

    const interval = setInterval(() => {
      setElapsedTime((Date.now() - activeTask.startTime) / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, [activeTask]);

  const formatTime = (sec: number) => {
    if (sec < 1) return `${(sec * 1000).toFixed(0)}ms`;
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const minutes = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(1);
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="space-y-0 px-4 py-3">
      {/* Completed tasks section */}
      {tasks.length > 0 && (
        <div className="space-y-1.5 pb-2">
          {tasks.map((task, idx) => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-2 group animate-in fade-in slide-in-from-bottom-2 duration-300"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-teal-400 text-xs font-semibold flex-shrink-0">✓</span>
                <span className="text-xs text-white/70 font-medium truncate group-hover:text-white/85 transition-colors">
                  {task.name}
                </span>
              </div>
              <span className="text-xs text-white/40 flex-shrink-0 tabular-nums">
                {task.duration ? formatTime(task.duration) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Separator */}
      {tasks.length > 0 && activeTask && (
        <div className="h-px bg-gradient-to-r from-white/5 via-white/10 to-transparent my-1.5" />
      )}

      {/* Active task */}
      {activeTask && (
        <div className="flex items-center justify-between gap-2 animate-pulse">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full" />
              <div className="absolute inset-0 w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
            </div>
            <span className="text-xs text-white/85 font-medium truncate">{activeTask.name}</span>
          </div>
          <span className="text-xs text-white/40 flex-shrink-0 tabular-nums">
            {formatTime(elapsedTime)}
          </span>
        </div>
      )}
    </div>
  );
}
