import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { useAIProgressStore } from '@/stores/ai-progress-store';
import { AIProgressIndicator } from '../ai-progress-indicator';

describe('AIProgressIndicator', () => {
  beforeEach(() => {
    useAIProgressStore.setState({
      activeTask: null,
      completedTasks: [],
      pendingTasks: [],
      progressPercentage: 0,
      isExpanded: false,
      autoCollapseTimer: null,
    });
  });

  it('should not render when there is no active task', () => {
    const { container } = render(<AIProgressIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('should render collapsed view when there is an active task', () => {
    const { result } = renderHook(() => useAIProgressStore());

    act(() => {
      result.current.addTask({ id: 'test', name: 'Testing' });
      result.current.startTask('test');
    });

    render(<AIProgressIndicator />);
    expect(screen.getByText(/Testing/i)).toBeInTheDocument();
  });

  it('should have correct positioning', () => {
    const { result } = renderHook(() => useAIProgressStore());

    act(() => {
      result.current.addTask({ id: 'test', name: 'Testing' });
      result.current.startTask('test');
    });

    const { container } = render(<AIProgressIndicator />);
    const indicator = container.querySelector('[role="region"]');

    expect(indicator).toHaveClass('fixed', 'bottom-5', 'right-5', 'z-50');
  });

  it('should have accessibility attributes', () => {
    const { result } = renderHook(() => useAIProgressStore());

    act(() => {
      result.current.addTask({ id: 'test', name: 'Testing' });
      result.current.startTask('test');
    });

    const { container } = render(<AIProgressIndicator />);
    const indicator = container.querySelector('[role="region"]');

    expect(indicator).toHaveAttribute('role', 'region');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
    expect(indicator).toHaveAttribute('aria-label', 'AI processing status');
  });

  it('should expand on hover when completed tasks exist', async () => {
    const { result } = renderHook(() => useAIProgressStore());

    act(() => {
      result.current.addTask({ id: 'task1', name: 'Task 1' });
      result.current.startTask('task1');
      result.current.completeTask('task1');
      result.current.addTask({ id: 'task2', name: 'Task 2' });
      result.current.startTask('task2');
    });

    const { container } = render(<AIProgressIndicator />);
    const indicator = container.querySelector('[role="region"]');

    act(() => {
      fireEvent.mouseEnter(indicator!);
    });

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
  });

  it('should toggle expand on click', async () => {
    const { result } = renderHook(() => useAIProgressStore());

    act(() => {
      result.current.addTask({ id: 'task1', name: 'Task 1' });
      result.current.startTask('task1');
      result.current.completeTask('task1');
      result.current.addTask({ id: 'task2', name: 'Task 2' });
      result.current.startTask('task2');
    });

    const { container } = render(<AIProgressIndicator />);
    const indicator = container.querySelector('[role="region"]');

    act(() => {
      fireEvent.click(indicator!);
    });

    await waitFor(() => {
      expect(result.current.isExpanded).toBe(true);
    });
  });

  it('should handle task completion', async () => {
    const { result } = renderHook(() => useAIProgressStore());

    act(() => {
      result.current.addTask({ id: 'task1', name: 'Task 1' });
      result.current.addTask({ id: 'task2', name: 'Task 2' });
      result.current.startTask('task1');
    });

    expect(result.current.activeTask?.id).toBe('task1');

    act(() => {
      result.current.completeTask('task1');
      result.current.startTask('task2');
    });

    expect(result.current.activeTask?.id).toBe('task2');
    expect(result.current.completedTasks).toHaveLength(1);
  });

  it('should clear all tasks', async () => {
    const { result } = renderHook(() => useAIProgressStore());

    act(() => {
      result.current.addTask({ id: 'task1', name: 'Task 1' });
      result.current.startTask('task1');
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.activeTask).toBeNull();
    expect(result.current.completedTasks).toHaveLength(0);
    expect(result.current.progressPercentage).toBe(0);
  });
});
