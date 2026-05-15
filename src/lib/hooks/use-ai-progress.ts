import { useRef, useCallback } from 'react';
import { useAIProgressStore } from '@/stores/ai-progress-store';

export function useAIProgress() {
  const { addTask, startTask, completeTask, setProgress } = useAIProgressStore();
  const taskIdRef = useRef<string | null>(null);

  const beginTask = useCallback((name: string) => {
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

  return { beginTask, updateProgress, endTask };
}
