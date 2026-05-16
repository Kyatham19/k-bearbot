import { create } from 'zustand';

export type AIPhase = 'planning' | 'searching' | 'analyzing' | 'synthesizing' | 'finalizing';

export interface AISearchSource {
  domain: string;
  title: string;
  timestamp: number;
}

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
  phase: AIPhase | null;
  searchSources: AISearchSource[];
  lastSourceDomain: string | null;
  isExpanded: boolean;
  autoCollapseTimer: NodeJS.Timeout | null;
  hideTimer: NodeJS.Timeout | null;

  // Actions
  addTask: (task: Omit<AITask, 'startTime' | 'status'>) => void;
  startTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  completeActiveTask: () => void;
  setProgress: (percentage: number) => void;
  setPhase: (phase: AIPhase) => void;
  addSearchSource: (source: AISearchSource) => void;
  setExpanded: (expanded: boolean) => void;
  clearAll: () => void;
  scheduleAutoCollapse: () => void;
  cancelAutoCollapse: () => void;
  scheduleHideAfterCompletion: () => void;
  cancelHideTimer: () => void;
}

export const useAIProgressStore = create<AIProgressState>((set, get) => ({
  activeTask: null,
  completedTasks: [],
  pendingTasks: [],
  progressPercentage: 0,
  phase: null,
  searchSources: [],
  lastSourceDomain: null,
  isExpanded: false,
  autoCollapseTimer: null,
  hideTimer: null,

  addTask: (task) => {
    get().cancelHideTimer();
    set((state) => ({
      pendingTasks: [...state.pendingTasks, { ...task, status: 'pending', startTime: Date.now() }],
    }));
  },

  startTask: (taskId: string) => {
    get().cancelHideTimer();
    set((state) => {
      const pending = state.pendingTasks.find((t) => t.id === taskId);
      if (!pending) return state;

      const now = Date.now();
      const newCompleted = state.activeTask
        ? [
            ...state.completedTasks,
            {
              ...state.activeTask,
              status: 'completed' as const,
              endTime: now,
              duration: (now - state.activeTask.startTime) / 1000,
            },
          ]
        : state.completedTasks;

      const updatedPending = state.pendingTasks.filter((t) => t.id !== taskId);

      return {
        activeTask: {
          ...pending,
          status: 'active' as const,
          startTime: Date.now(),
        },
        completedTasks: newCompleted,
        pendingTasks: updatedPending,
        progressPercentage: Math.max(state.progressPercentage, 6),
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
      };
    });
  },

  completeActiveTask: () => {
    const active = get().activeTask;
    if (!active) return;
    get().completeTask(active.id);
  },

  setProgress: (percentage: number) => {
    set((state) => {
      const next = Math.max(0, Math.min(percentage, 100));
      return {
        progressPercentage: next < 100 ? Math.max(state.progressPercentage, next) : next,
      };
    });
  },

  setPhase: (phase: AIPhase) => {
    set(() => ({ phase }));
  },

  addSearchSource: (source: AISearchSource) => {
    set((state) => {
      const idx = state.searchSources.findIndex((s) => s.domain === source.domain);
      if (idx === -1) {
        return {
          searchSources: [...state.searchSources, source],
          lastSourceDomain: source.domain,
        };
      }
      const updated = [...state.searchSources];
      updated[idx] = { ...updated[idx], title: source.title, timestamp: source.timestamp };
      return {
        searchSources: updated,
        lastSourceDomain: source.domain,
      };
    });
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
    }, 3000);

    set({ autoCollapseTimer: timer });
  },

  cancelAutoCollapse: () => {
    const state = get();
    if (state.autoCollapseTimer) {
      clearTimeout(state.autoCollapseTimer);
      set({ autoCollapseTimer: null });
    }
  },

  scheduleHideAfterCompletion: () => {
    const state = get();
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
    }
    const timer = setTimeout(() => {
      set({ isExpanded: false, hideTimer: null });
      setTimeout(() => {
        get().clearAll();
      }, 1000);
    }, 2000);
    set({ hideTimer: timer });
  },

  cancelHideTimer: () => {
    const state = get();
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      set({ hideTimer: null });
    }
  },

  clearAll: () => {
    set((state) => {
      if (state.autoCollapseTimer) {
        clearTimeout(state.autoCollapseTimer);
      }
      if (state.hideTimer) {
        clearTimeout(state.hideTimer);
      }
      return {
        activeTask: null,
        completedTasks: [],
        pendingTasks: [],
        progressPercentage: 0,
        phase: null,
        searchSources: [],
        lastSourceDomain: null,
        isExpanded: false,
        autoCollapseTimer: null,
        hideTimer: null,
      };
    });
  },
}));
