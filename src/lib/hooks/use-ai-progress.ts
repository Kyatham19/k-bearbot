import { useRef, useCallback } from 'react';
import { useAIProgressStore } from '@/stores/ai-progress-store';

export function useAIProgress() {
  const { addTask, startTask, completeTask, setProgress, clearAll } = useAIProgressStore();
  const taskIdRef = useRef<string | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const beginTask = useCallback((name: string) => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    const taskId = `task-${Date.now()}-${Math.random()}`;
    taskIdRef.current = taskId;
    addTask({ id: taskId, name });
    startTask(taskId);
    return taskId;
  }, [addTask, startTask]);

  const updateProgress = useCallback((pct: number) => {
    setProgress(pct);
  }, [setProgress]);

  const endTask = useCallback(() => {
    if (taskIdRef.current) {
      completeTask(taskIdRef.current);
      taskIdRef.current = null;
    }
  }, [completeTask]);

  const startStep = useCallback((name: string, pct?: number) => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (taskIdRef.current) {
      completeTask(taskIdRef.current);
      taskIdRef.current = null;
    }
    const taskId = `task-${Date.now()}-${Math.random()}`;
    taskIdRef.current = taskId;
    addTask({ id: taskId, name });
    startTask(taskId);
    if (typeof pct === 'number') {
      setProgress(pct);
    }
    return taskId;
  }, [addTask, completeTask, setProgress, startTask]);

  const finishAll = useCallback(() => {
    if (taskIdRef.current) {
      completeTask(taskIdRef.current);
      taskIdRef.current = null;
    }
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = window.setTimeout(() => {
      clearAll();
      clearTimerRef.current = null;
    }, 900);
  }, [clearAll, completeTask]);

  return { beginTask, updateProgress, endTask, startStep, finishAll };
}
