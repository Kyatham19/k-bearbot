// Rate limiting middleware for API routes
// Uses memory store - upgrade to Redis for distributed systems

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

interface RateLimitStore {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store: Map<string, RateLimitStore> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60_000);
  }

  private getKey(identifier: string): string {
    return `rate-limit:${identifier}`;
  }

  check(identifier: string): boolean {
    const key = this.getKey(identifier);
    const now = Date.now();

    let entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + this.config.windowMs };
      this.store.set(key, entry);
    }

    entry.count++;

    if (entry.count > this.config.maxRequests) {
      logger.warn('Rate limit exceeded', {
        identifier,
        count: entry.count,
        limit: this.config.maxRequests,
      });
      return false;
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) {
        this.store.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug('Rate limiter cleanup', { removedCount });
    }
  }

  reset(identifier: string): void {
    this.store.delete(this.getKey(identifier));
  }

  stats() {
    return {
      entries: this.store.size,
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
    };
  }
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  // Chat endpoint - 30 requests per minute
  chat: new RateLimiter({ maxRequests: 30, windowMs: 60 * 1000 }),

  // Stock search - 60 requests per minute
  stock: new RateLimiter({ maxRequests: 60, windowMs: 60 * 1000 }),

  // General API - 100 requests per minute
  general: new RateLimiter({ maxRequests: 100, windowMs: 60 * 1000 }),
};

export function createRateLimitMiddleware(limiter: RateLimiter) {
  return (request: NextRequest, identifier: string) => {
    if (!limiter.check(identifier)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    return null; // Request allowed
  };
}

// Helper to extract user identifier from request
export function getUserIdentifier(request: NextRequest): string {
  // Try to get user ID from auth cookie or header
  const userId =
    request.headers.get('x-user-id') ||
    request.cookies.get('user-id')?.value ||
    request.headers.get('x-forwarded-for') ||
    'anonymous';

  return userId;
}
