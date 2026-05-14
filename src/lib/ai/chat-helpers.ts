// Helper functions extracted from chat route for better organization and testing

import { caches } from '@/lib/cache';
import { logger } from '@/lib/logger';
import type { StockAnalysis } from '@/types/stock';

const TICKER_PATTERN = /\$([A-Z]{1,10}(?:\.[A-Z]{1,2})?)\b/;
const NOUN_PHRASE_PATTERN =
  /(?:analyze|analysis\s+of|price\s+of|quote\s+for|stock\s+of)\s+([a-zA-Z0-9.&\-\s]{2,40})/i;

export function detectStockQuery(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const dollarMatch = trimmed.match(TICKER_PATTERN);
  if (dollarMatch?.[1]) return dollarMatch[1].toUpperCase();

  if (/^[A-Z]{1,10}(\.[A-Z]{1,2})?$/.test(trimmed)) return trimmed.toUpperCase();

  const nounPhraseMatch = trimmed.match(NOUN_PHRASE_PATTERN);
  if (nounPhraseMatch?.[1]) return nounPhraseMatch[1].trim();

  return null;
}

export function isGreeting(message: string): boolean {
  const t = message.trim().toLowerCase().replace(/[!.?]+$/g, '');
  return (
    t.length <= 20 &&
    /^(hi|hey|hello|yo|sup|howdy|good\s+(morning|afternoon|evening|night)|thanks|thank\s+you|ok|okay|bye)$/.test(
      t
    )
  );
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out`)),
      timeoutMs
    );
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function withStreamTimeout(
  stream: ReadableStream<Uint8Array>,
  timeoutMs: number,
  fallback: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();
      try {
        while (true) {
          const result = await Promise.race<
            ReadableStreamReadResult<Uint8Array> | { timeout: true }
          >([
            reader.read(),
            new Promise<{ timeout: true }>((resolve) =>
              setTimeout(() => resolve({ timeout: true }), timeoutMs)
            ),
          ]);

          if ('timeout' in result) {
            controller.enqueue(encoder.encode(fallback));
            await reader.cancel('stream timed out');
            controller.close();
            return;
          }

          if (result.done) {
            controller.close();
            return;
          }

          if (result.value) controller.enqueue(result.value);
        }
      } catch (error) {
        logger.error('Stream timeout error', error);
        controller.close();
      }
    },
  });
}

export async function getCachedStockAnalysis(
  symbol: string
): Promise<StockAnalysis | null> {
  return caches.details.get(`analysis:${symbol}`) || null;
}

export function cacheStockAnalysis(
  symbol: string,
  analysis: StockAnalysis
): void {
  caches.details.set(`analysis:${symbol}`, analysis);
  logger.debug('Cached stock analysis', { symbol });
}

export function invalidateStockCache(symbol: string): void {
  caches.quotes.del(`quote:${symbol}`);
  caches.details.del(`analysis:${symbol}`);
  logger.debug('Invalidated stock cache', { symbol });
}
