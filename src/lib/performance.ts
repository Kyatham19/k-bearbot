// Performance optimization utilities

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Measures execution time of an async function and logs performance metrics
 */
export async function measurePerformance<T>(
  label: string,
  fn: () => Promise<T>,
  warnThresholdMs = 1000
): Promise<T> {
  const startMs = performance.now();
  try {
    const result = await fn();
    const durationMs = performance.now() - startMs;

    if (durationMs > warnThresholdMs) {
      logger.warn(`${label} took ${durationMs.toFixed(2)}ms (threshold: ${warnThresholdMs}ms)`);
    } else {
      logger.debug(`${label} completed in ${durationMs.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    const durationMs = performance.now() - startMs;
    logger.error(`${label} failed after ${durationMs.toFixed(2)}ms`, error);
    throw error;
  }
}

/**
 * Returns a NextResponse with proper caching headers
 */
export function cachedResponse<T>(
  data: T,
  cacheSeconds: number,
  status = 200
): NextResponse<T> {
  const response = NextResponse.json(data, { status });

  if (cacheSeconds > 0) {
    response.headers.set(
      'Cache-Control',
      `public, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`
    );
  } else {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  return response;
}

/**
 * Returns a NextResponse with compression hints
 */
export function compressedResponse<T>(
  data: T,
  status = 200
): NextResponse<T> {
  const response = NextResponse.json(data, { status });
  response.headers.set('Content-Encoding', 'gzip');
  response.headers.set('Vary', 'Accept-Encoding');
  return response;
}

/**
 * Debounce function execution to prevent thundering herd
 */
export function debounce<Args extends any[], Return>(
  fn: (...args: Args) => Promise<Return>,
  delayMs: number
) {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastResult: Return | null = null;

  return async (...args: Args): Promise<Return> => {
    return new Promise((resolve) => {
      if (timeoutId) clearTimeout(timeoutId);

      if (lastResult) {
        resolve(lastResult);
        return;
      }

      timeoutId = setTimeout(async () => {
        try {
          lastResult = await fn(...args);
          resolve(lastResult);
        } catch (error) {
          logger.error('Debounced function error', error);
          throw error;
        } finally {
          timeoutId = null;
        }
      }, delayMs);
    });
  };
}

/**
 * Memoizes async function results with optional TTL
 */
export function memoizeAsync<Args extends any[], Return>(
  fn: (...args: Args) => Promise<Return>,
  keyFn: (...args: Args) => string,
  ttlMs = 60_000
) {
  const cache = new Map<string, { result: Return; expiresAt: number }>();

  return async (...args: Args): Promise<Return> => {
    const key = keyFn(...args);
    const cached = cache.get(key);

    if (cached && Date.now() < cached.expiresAt) {
      logger.debug('Memoized hit', { key });
      return cached.result;
    }

    logger.debug('Memoized miss', { key });
    const result = await fn(...args);
    cache.set(key, { result, expiresAt: Date.now() + ttlMs });
    return result;
  };
}

/**
 * Implements exponential backoff retry logic
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`, {
          error: lastError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Returns performance metrics
 */
export function getPerformanceMetrics() {
  if (typeof performance === 'undefined') {
    return { memory: 'N/A', uptime: 'N/A' };
  }

  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  return {
    memory: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    },
    uptime: `${Math.floor(uptime / 60)} minutes`,
  };
}
