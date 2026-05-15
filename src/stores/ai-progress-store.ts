import { create } from 'zustand';

export interface AITask {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed';
  startTime: number;
  endTime?: number;
  duration?: number;
}

interface AIProgressState {
  activeTask: AITask | null;
  completedTasks: AITask[];
  pendingTasks: AITask[];
  progressPercentage: number;
  isExpanded: boolean;
  autoCollapseTimer: NodeJS.Timeout | null;

  // Actions
  addTask: (task: Omit<AITask, 'startTime' | 'status'>) => void;
  startTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  setProgress: (percentage: number) => void;
  setExpanded: (expanded: boolean) => void;
  clearAll: () => void;
  scheduleAutoCollapse: () => void;
  cancelAutoCollapse: () => void;
}

export const useAIProgressStore = create<AIProgressState>((set, get) => ({
  activeTask: null,
  completedTasks: [],
  pendingTasks: [],
  progressPercentage: 0,
  isExpanded: false,
  autoCollapseTimer: null,

  addTask: (task) => {
    set((state) => ({
      pendingTasks: [...state.pendingTasks, { ...task, status: 'pending', startTime: Date.now() }],
    }));
  },

  startTask: (taskId: string) => {
    set((state) => {
      const pending = state.pendingTasks.find((t) => t.id === taskId);
      if (!pending) return state;

      // Move previous active task to completed
      const newCompleted =
        state.activeTask ? [...state.completedTasks, { ...state.activeTask, status: 'completed' as const }] : state.completedTasks;

      const updatedPending = state.pendingTasks.filter((t) => t.id !== taskId);

      return {
        activeTask: {
          ...pending,
          status: 'active' as const,
          startTime: Date.now(),
        },
        completedTasks: newCompleted,
        pendingTasks: updatedPending,
        progressPercentage: 15, // Reset progress when new task starts
      };
    });
  },

  completeTask: (taskId: string) => {
    set((state) => {
      if (!state.activeTask || state.activeTask.id !== taskId) return state;

      const now = Date.now();
      const duration = (now - state.activeTask.startTime) / 1000; // Convert to seconds

      return {
        completedTasks: [
          ...state.completedTasks,
          {
            ...state.activeTask,
            status: 'completed' as const,
            endTime: now,
            duration,
          },
        ],
        activeTask: null,
        progressPercentage: 0,
      };
    });
  },

  setProgress: (percentage: number) => {
    set(() => ({
      progressPercentage: Math.min(percentage, 99), // Cap at 99% until task completes
    }));
  },

  setExpanded: (expanded: boolean) => {
    set(() => {
      const state = get();
      if (state.autoCollapseTimer && expanded === false) {
        clearTimeout(state.autoCollapseTimer);
      }
      return { isExpanded: expanded };
    });
  },

  scheduleAutoCollapse: () => {
    const state = get();
    if (state.autoCollapseTimer) {
      clearTimeout(state.autoCollapseTimer);
    }

    const timer = setTimeout(() => {
      set({ isExpanded: false, autoCollapseTimer: null });
    }, 3000); // Auto-collapse after 3 seconds of no hover

    set({ autoCollapseTimer: timer });
  },

  cancelAutoCollapse: () => {
    const state = get();
    if (state.autoCollapseTimer) {
      clearTimeout(state.autoCollapseTimer);
      set({ autoCollapseTimer: null });
    }
  },

  clearAll: () => {
    set((state) => {
      if (state.autoCollapseTimer) {
        clearTimeout(state.autoCollapseTimer);
      }
      return {
        activeTask: null,
        completedTasks: [],
        pendingTasks: [],
        progressPercentage: 0,
        isExpanded: false,
        autoCollapseTimer: null,
      };
    });
  },
}));
