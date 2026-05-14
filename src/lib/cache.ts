// Cache utility with memory store and Redis-ready interface
// Easy to swap to Redis later via environment variable

import { logger } from '@/lib/logger';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheConfig {
  ttlMs: number;
}

export class Cache<T> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private ttlMs: number;

  constructor(config: CacheConfig) {
    this.ttlMs = config.ttlMs;
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60_000);
  }

  set(key: string, value: T): void {
    const expiresAt = Date.now() + this.ttlMs;
    this.store.set(key, { value, expiresAt });
    logger.debug('Cache set', { key, ttlMs: this.ttlMs });
  }

  get(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      logger.debug('Cache miss', { key });
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      logger.debug('Cache expired', { key });
      return null;
    }

    logger.debug('Cache hit', { key });
    return entry.value;
  }

  del(key: string): void {
    this.store.delete(key);
    logger.debug('Cache deleted', { key });
  }

  clear(): void {
    this.store.clear();
    logger.debug('Cache cleared');
  }

  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug('Cache cleanup', { removedCount });
    }
  }

  stats() {
    return {
      size: this.store.size,
      ttlMs: this.ttlMs,
    };
  }
}

// Pre-configured caches for common use cases
export const caches = {
  // Stock quotes cache - 2 minute TTL
  quotes: new Cache<any>({ ttlMs: 2 * 60 * 1000 }),

  // Stock details cache - 5 minute TTL
  details: new Cache<any>({ ttlMs: 5 * 60 * 1000 }),

  // News cache - 10 minute TTL
  news: new Cache<any>({ ttlMs: 10 * 60 * 1000 }),

  // Search results cache - 1 hour TTL
  search: new Cache<any>({ ttlMs: 60 * 60 * 1000 }),
};
