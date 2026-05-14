import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '@/stores/app-store';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const state = useAppStore.getState();
    useAppStore.setState({
      conversations: [],
      messages: [],
      activeConversationId: null,
      isLoadingConversation: false,
      activeView: 'chat',
      sidebarOpen: true,
    });
  });

  it('should toggle sidebar', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setSidebarOpen(false);
    });

    expect(result.current.sidebarOpen).toBe(false);

    act(() => {
      result.current.toggleSidebar();
    });

    expect(result.current.sidebarOpen).toBe(true);
  });

  it('should add a message', () => {
    const { result } = renderHook(() => useAppStore());
    const testMessage = {
      id: 'msg1',
      conversation_id: 'conv1',
      role: 'user' as const,
      content: 'Hello',
      metadata: null,
      created_at: new Date().toISOString(),
    };

    act(() => {
      result.current.addMessage(testMessage);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Hello');
  });

  it('should append to message', () => {
    const { result } = renderHook(() => useAppStore());
    const testMessage = {
      id: 'msg1',
      conversation_id: 'conv1',
      role: 'assistant' as const,
      content: 'Hello',
      metadata: null,
      created_at: new Date().toISOString(),
    };

    act(() => {
      result.current.addMessage(testMessage);
    });

    act(() => {
      result.current.appendToMessage('msg1', ' World');
    });

    expect(result.current.messages[0].content).toBe('Hello World');
  });

  it('should set active view', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setActiveView('portfolio');
    });

    expect(result.current.activeView).toBe('portfolio');
  });

  it('should set streaming state', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setStreaming(true);
    });

    expect(result.current.isStreaming).toBe(true);

    act(() => {
      result.current.setStreaming(false);
    });

    expect(result.current.isStreaming).toBe(false);
  });
});
