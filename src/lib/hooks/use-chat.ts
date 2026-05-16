'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAppStore, type ChatMessage } from '@/stores/app-store';
import { generateId } from '@/lib/utils';
import { useAIProgress } from '@/lib/hooks/use-ai-progress';

const EMPTY_RESPONSE_FALLBACK =
  'Unable to generate analysis right now. Showing available data below.';

const AI_PROGRESS_FRAME_PREFIX = '\u001eALPHASIGHT_PROGRESS:';
const AI_PROGRESS_FRAME_SUFFIX = '\u001e';

type AIProgressFrame = {
  type?: 'progress' | 'search_source' | 'phase_update' | 'task_complete';
  label?: string;
  progress?: number;
  status?: 'active' | 'complete';
  phase?: 'planning' | 'searching' | 'analyzing' | 'synthesizing' | 'finalizing';
  domain?: string;
  title?: string;
  timestamp?: number;
};

function hasVisibleText(value: string): boolean {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim().length > 0;
}

export function useChat() {
  const {
    activeConversationId,
    messages,
    isStreaming,
    preferredModel,
    addMessage,
    appendToMessage,
    updateMessage,
    setIsStreaming,
    setActiveConversation,
    setActiveView,
    addConversation,
    setMessages,
  } = useAppStore();

  const { startStep, updateProgress, finishAll, updatePhase, trackSearchSource, completeCurrentTask } =
    useAIProgress();
  const abortRef = useRef<AbortController | null>(null);
  const frameBatchRef = useRef<AIProgressFrame[]>([]);
  const frameFlushTimerRef = useRef<number | null>(null);

  const flushProgressFrames = useCallback(() => {
    if (frameFlushTimerRef.current !== null) {
      window.clearTimeout(frameFlushTimerRef.current);
      frameFlushTimerRef.current = null;
    }
    const batch = frameBatchRef.current.splice(0, frameBatchRef.current.length);
    if (batch.length === 0) return;

    const latestProgress = [...batch].reverse().find((f) => !f.type || f.type === 'progress');
    const latestPhase = [...batch].reverse().find((f) => f.type === 'phase_update' && f.phase);
    const hasTaskComplete = batch.some((f) => f.type === 'task_complete');

    batch.forEach((frame) => {
      if (frame.type === 'search_source' && frame.domain && frame.title) {
        trackSearchSource({
          domain: frame.domain,
          title: frame.title,
          timestamp: frame.timestamp,
        });
      }
    });

    if (latestPhase?.phase) {
      updatePhase(latestPhase.phase, latestPhase.label);
    } else if (latestProgress?.label) {
      startStep(latestProgress.label, latestProgress.progress);
    } else if (typeof latestProgress?.progress === 'number') {
      updateProgress(latestProgress.progress);
    }

    if (latestProgress?.status === 'complete') {
      finishAll();
      return;
    }

    if (hasTaskComplete) {
      completeCurrentTask();
    }
  }, [completeCurrentTask, finishAll, startStep, trackSearchSource, updatePhase, updateProgress]);

  const enqueueProgressFrame = useCallback((frame: AIProgressFrame) => {
    frameBatchRef.current.push(frame);
    if (frameFlushTimerRef.current !== null) return;
    frameFlushTimerRef.current = window.setTimeout(() => {
      flushProgressFrames();
    }, 90);
  }, [flushProgressFrames]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (frameFlushTimerRef.current !== null) {
        window.clearTimeout(frameFlushTimerRef.current);
        frameFlushTimerRef.current = null;
      }
      frameBatchRef.current = [];
    };
  }, []);

  const sendMessage = useCallback(
    async (content: string, opts?: { forceWebSearch?: boolean }) => {
      if (!content.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        conversation_id: activeConversationId || '',
        role: 'user',
        content: content.trim(),
        metadata: null,
        created_at: new Date().toISOString(),
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        conversation_id: activeConversationId || '',
        role: 'assistant',
        content: '',
        metadata: null,
        created_at: new Date().toISOString(),
        isStreaming: true,
      };

      addMessage(userMsg);
      addMessage(assistantMsg);
      setIsStreaming(true);
      updatePhase('planning', 'Planning request');
      startStep('Sending request to AlphaSight...', 6);
       
      console.debug('[useChat] sendMessage:start', {
        activeConversationId,
        messageLength: userMsg.content.length,
      });

      const abortController = new AbortController();
      abortRef.current = abortController;
      let didTimeout = false;
      let streamingDone = false;
      const timeoutId = setTimeout(() => {
        if (streamingDone) return;
        didTimeout = true;
        try {
          abortController.abort();
        } catch {
          // abort() can throw if the underlying fetch has already settled; ignore
        }
      }, 120000);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg.content,
            conversationId: activeConversationId,
            model: preferredModel,
            forceWebSearch: opts?.forceWebSearch === true,
          }),
          signal: abortController.signal,
        });

        const contentType = res.headers.get('content-type') || '';
        console.debug('[useChat] sendMessage:api-response', {
          status: res.status,
          contentType,
          hasBody: Boolean(res.body),
        });
        if (res.redirected || contentType.includes('text/html')) {
          throw new Error('AUTH_REDIRECT');
        }

        // Support structured non-stream responses if backend returns JSON.
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json().catch(() => ({} as Record<string, unknown>));
          const text =
            typeof data.text === 'string'
              ? data.text
              : typeof data.message === 'string'
                ? data.message
                : EMPTY_RESPONSE_FALLBACK;
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: hasVisibleText(text) ? text : EMPTY_RESPONSE_FALLBACK,
          });
          finishAll();
          streamingDone = true;
          clearTimeout(timeoutId);
          console.debug('[useChat] sendMessage:json-response-applied', {
            hasText: hasVisibleText(text),
          });
          return;
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMsg = errorData.details || errorData.error || `HTTP ${res.status}`;
          const friendlyMessage =
            res.status === 401
              ? 'Your session expired. Please log in again.'
              : res.status === 503
                ? 'AI service is temporarily unavailable. Please try again in a moment.'
                : `Unable to generate analysis right now. Showing available data below. (${errorMsg})`;
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: friendlyMessage,
          });
          finishAll();
          streamingDone = true;
          clearTimeout(timeoutId);
          console.error('[useChat] sendMessage:non-ok', {
            status: res.status,
            errorMsg,
          });
          return;
        }

        // The server sends a short placeholder so the chart can render
        // immediately. Full quote data is rehydrated from DB metadata when the
        // conversation loads (see providers.tsx).
        const stockSymbol = res.headers.get('x-stock-symbol');
        const stockExchange = res.headers.get('x-stock-exchange') || '';
        if (stockSymbol) {
          const placeholder = {
            symbol: stockSymbol,
            exchange: stockExchange,
          } as NonNullable<ChatMessage['stockData']>[number];
          updateMessage(assistantMsg.id, { stockData: [placeholder] });
        }

        const newConvId = res.headers.get('x-conversation-id');
        const effectiveConversationId = newConvId || activeConversationId;
        let shouldReplaceUrlAfterStream = false;
        if (newConvId && !activeConversationId) {
          // Stamp local messages with the new conversation_id FIRST so the
          // providers' loadMessages guard (which filters by conversation_id)
          // can see the pending assistant bubble and skip the DB overwrite.
          updateMessage(userMsg.id, { conversation_id: newConvId });
          updateMessage(assistantMsg.id, { conversation_id: newConvId });
          addConversation({
            id: newConvId,
            user_id: '',
            title: content.trim().slice(0, 60),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setActiveConversation(newConvId);
          setActiveView('chat');
          shouldReplaceUrlAfterStream = true;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: EMPTY_RESPONSE_FALLBACK,
          });
          console.error('[useChat] sendMessage:no-reader');
          return;
        }

        const decoder = new TextDecoder();
        let done = false;
        let collectedAny = false;
        let fullAssistantText = '';
        let progressBuffer = '';

        let firstChunkLogged = false;

        const handleProgressFrame = (frame: AIProgressFrame) => {
          enqueueProgressFrame(frame);
        };

        const consumeProgressFrames = (input: string, flush = false) => {
          progressBuffer += input;
          let visible = '';

          while (true) {
            const start = progressBuffer.indexOf(AI_PROGRESS_FRAME_PREFIX);
            if (start === -1) {
              const keep = flush ? 0 : Math.max(AI_PROGRESS_FRAME_PREFIX.length - 1, 0);
              if (progressBuffer.length > keep) {
                visible += progressBuffer.slice(0, progressBuffer.length - keep);
                progressBuffer = progressBuffer.slice(progressBuffer.length - keep);
              }
              break;
            }

            visible += progressBuffer.slice(0, start);
            const jsonStart = start + AI_PROGRESS_FRAME_PREFIX.length;
            const end = progressBuffer.indexOf(AI_PROGRESS_FRAME_SUFFIX, jsonStart);
            if (end === -1) {
              progressBuffer = progressBuffer.slice(start);
              break;
            }

            const raw = progressBuffer.slice(jsonStart, end);
            progressBuffer = progressBuffer.slice(end + AI_PROGRESS_FRAME_SUFFIX.length);
            try {
              handleProgressFrame(JSON.parse(raw) as AIProgressFrame);
            } catch {
              // Ignore malformed progress metadata and keep the chat stream alive.
            }
          }

          if (flush && progressBuffer) {
            visible += progressBuffer;
            progressBuffer = '';
          }
          return visible;
        };
        
        while (!done) {
          let readResult: ReadableStreamReadResult<Uint8Array>;
          try {
            readResult = await reader.read();
          } catch (readErr) {
            // reader.read() rejects with AbortError when we abort the fetch
            // on timeout. Let the outer catch handle the UI; just bail out
            // of the loop without surfacing a scary stream error overlay.
            if (readErr instanceof DOMException && readErr.name === 'AbortError') {
              break;
            }
            throw readErr;
          }
          const { value, done: readerDone } = readResult;
          done = readerDone;
          if (value) {
            const text = consumeProgressFrames(decoder.decode(value, { stream: true }));
            if (text.length > 0) {
              fullAssistantText += text;
              if (hasVisibleText(text)) collectedAny = true;
              if (!firstChunkLogged) {
                firstChunkLogged = true;
                console.debug('[useChat] first-chunk', {
                  preview: text.slice(0, 120),
                  length: text.length,
                });
              }
            }
            appendToMessage(assistantMsg.id, text);
          }
        }
        const tailText = consumeProgressFrames('', true);
        flushProgressFrames();
        if (tailText.length > 0) {
          fullAssistantText += tailText;
          if (hasVisibleText(tailText)) collectedAny = true;
          appendToMessage(assistantMsg.id, tailText);
        }
        streamingDone = true;
        clearTimeout(timeoutId);
        console.debug('[useChat] sendMessage:stream-complete', {
          collectedAny,
          chars: fullAssistantText.length,
          visible: hasVisibleText(fullAssistantText),
        });

        // Belt-and-suspenders: if the stream closed without a single chunk,
        // put a visible message into the bubble so it's never blank.
        if (!collectedAny || !hasVisibleText(fullAssistantText)) {
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: EMPTY_RESPONSE_FALLBACK,
          });
        } else {
          updateMessage(assistantMsg.id, { isStreaming: false });
        }

        if (effectiveConversationId) {
          console.debug('[useChat] sendMessage:metadata-hydrate', {
            conversationId: effectiveConversationId,
          });
          const hydrateRes = await fetch(
            `/api/conversations/${effectiveConversationId}/messages?limit=200`
          );
          if (hydrateRes.ok) {
            const hydrateData = await hydrateRes.json();
            const latestAssistant = [...(hydrateData.messages || [])]
              .reverse()
              .find(
                (m: { role?: string; metadata?: unknown; content?: string }) =>
                  m.role === 'assistant' && typeof m.content === 'string'
              );
            if (latestAssistant?.metadata && typeof latestAssistant.metadata === 'object') {
              const md = latestAssistant.metadata as {
                stockData?: unknown;
                news?: unknown;
                sources?: unknown;
              };
              const stockData = Array.isArray(md.stockData)
                ? md.stockData
                : md.stockData
                  ? [md.stockData]
                  : undefined;
              const newsData = Array.isArray(md.news) ? md.news : undefined;
              const sources = Array.isArray(md.sources) ? md.sources : undefined;
              updateMessage(assistantMsg.id, {
                ...(stockData ? { stockData: stockData as ChatMessage['stockData'] } : {}),
                ...(newsData ? { newsData: newsData as ChatMessage['newsData'] } : {}),
                ...(sources ? { sources: sources as ChatMessage['sources'] } : {}),
              });
              console.debug('[useChat] sendMessage:metadata-applied', {
                hasStock: Boolean(stockData),
                hasNews: Boolean(newsData),
                hasSources: Boolean(sources),
              });
            }
          }
        }

        if (shouldReplaceUrlAfterStream && effectiveConversationId) {
          window.history.replaceState(null, '', `/chat/${effectiveConversationId}`);
        }
      } catch (err: unknown) {
        console.error('CHAT ERROR:', err);
        if (err instanceof DOMException && err.name === 'AbortError') {
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: didTimeout
              ? 'The response timed out. Please try again.'
              : 'Response was cancelled.',
          });
        } else {
          const isAuthRedirect = err instanceof Error && err.message === 'AUTH_REDIRECT';
          const message = isAuthRedirect
            ? 'Your session expired. Please log in again.'
            : `Sorry, something went wrong. Please try again.${err instanceof Error ? ` (${err.message})` : ''}`;
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: message,
          });
        }
      } finally {
        clearTimeout(timeoutId);
        setIsStreaming(false);
        flushProgressFrames();
        finishAll();
        abortRef.current = null;
      }
    },
    [
      activeConversationId,
      isStreaming,
      preferredModel,
      addMessage,
      appendToMessage,
      updateMessage,
      setIsStreaming,
      setActiveConversation,
      setActiveView,
      addConversation,
      startStep,
      finishAll,
      updatePhase,
      enqueueProgressFrame,
      flushProgressFrames,
    ],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      // Remove both the failed assistant reply and the user message that triggered it
      const lastUserIdx = messages.lastIndexOf(lastUserMsg);
      const filtered = messages.slice(0, lastUserIdx);
      setMessages(filtered);
      sendMessage(lastUserMsg.content);
    }
  }, [messages, setMessages, sendMessage]);

  return { sendMessage, stopStreaming, retry, isStreaming };
}
