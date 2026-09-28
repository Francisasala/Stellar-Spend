/**
 * Rate limiting middleware for public API routes (issue #967).
 * Provides abuse prevention without requiring authentication.
 * Uses IP addresses or account identifiers for tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Configuration for a route-specific rate limit.
 */
export interface RouteRateLimitConfig {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Store for tracking rate limit state.
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory store for rate limit tracking.
 * Note: For production multi-instance deployments, use Redis instead.
 */
class PublicApiRateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetTime) {
      // Create new entry
      this.store.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return 1;
    }

    // Increment existing entry
    entry.count += 1;
    return entry.count;
  }

  async get(key: string): Promise<number> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) return 0;
    if (now >= entry.resetTime) {
      this.store.delete(key);
      return 0;
    }

    return entry.count;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

/**
 * Global rate limit store instance.
 */
const globalRateLimitStore = new PublicApiRateLimitStore();

/**
 * Route-specific rate limit configurations for public API endpoints.
 */
export const PUBLIC_API_RATE_LIMITS: Record<string, RouteRateLimitConfig> = {
  // Auth routes
  '/api/auth/login': { maxRequests: 5, windowMs: 60_000 },
  '/api/auth/logout': { maxRequests: 20, windowMs: 60_000 },
  '/api/auth/refresh': { maxRequests: 30, windowMs: 60_000 },
  '/api/auth/2fa/verify': { maxRequests: 5, windowMs: 60_000 },
  '/api/auth/2fa/request': { maxRequests: 3, windowMs: 60_000 },

  // Offramp routes - quote and rate endpoints
  '/api/offramp/quote': { maxRequests: 30, windowMs: 60_000 },
  '/api/offramp/currencies': { maxRequests: 100, windowMs: 60_000 },
  '/api/offramp/rate': { maxRequests: 50, windowMs: 10_000 },
  '/api/offramp/status': { maxRequests: 30, windowMs: 10_000 },

  // Offramp transaction routes
  '/api/offramp/execute-payout': { maxRequests: 5, windowMs: 60_000 },
  '/api/offramp/paycrest/order': { maxRequests: 5, windowMs: 60_000 },

  // Bridge routes
  '/api/offramp/bridge/build-tx': { maxRequests: 10, windowMs: 60_000 },
  '/api/offramp/bridge/submit-soroban': { maxRequests: 5, windowMs: 60_000 },
  '/api/offramp/bridge/status': { maxRequests: 30, windowMs: 10_000 },

  // Onramp routes
  '/api/onramp/quote': { maxRequests: 30, windowMs: 60_000 },
  '/api/onramp/currencies': { maxRequests: 100, windowMs: 60_000 },
  '/api/onramp/providers': { maxRequests: 50, windowMs: 60_000 },

  // Transaction routes
  '/api/transactions/submit': { maxRequests: 10, windowMs: 60_000 },
  '/api/transactions/status': { maxRequests: 50, windowMs: 10_000 },
  '/api/transactions/history': { maxRequests: 30, windowMs: 60_000 },

  // Wallet routes
  '/api/wallet/create': { maxRequests: 3, windowMs: 60_000 },
  '/api/wallet/balance': { maxRequests: 50, windowMs: 10_000 },
  '/api/wallet/validate': { maxRequests: 20, windowMs: 60_000 },

  // Compliance routes
  '/api/compliance/screen': { maxRequests: 10, windowMs: 60_000 },
  '/api/compliance/kyc/submit': { maxRequests: 5, windowMs: 60_000 },

  // Health check - no limit
  '/api/health': { maxRequests: 1000, windowMs: 60_000 },
  '/api/health/deep': { maxRequests: 100, windowMs: 60_000 },
};

/**
 * Extract client identifier from request.
 * Uses account ID if authenticated, otherwise falls back to IP address.
 */
export function getClientIdentifier(request: NextRequest, isAuthenticated: boolean): string {
  if (isAuthenticated) {
    const accountId = request.headers.get('x-account-id');
    if (accountId) return `account:${accountId}`;

    const userId = request.headers.get('x-user-id');
    if (userId) return `user:${userId}`;
  }

  // Fall back to IP address for unauthenticated requests
  return getClientIp(request) || 'unknown';
}

/**
 * Extract client IP address from request.
 * Checks forwarded headers (X-Forwarded-For, X-Real-IP) for proxied requests.
 */
export function getClientIp(request: NextRequest): string | null {
  // Check X-Forwarded-For first (used by reverse proxies like nginx, CloudFlare)
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // Take the first IP in the chain (original client)
    return xForwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP (used by some reverse proxies)
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  // Try to get from connection info (works in some Node.js setups)
  const forwardedProto = request.headers.get('cf-connecting-ip');
  if (forwardedProto) {
    return forwardedProto;
  }

  return null;
}

/**
 * Check if route has rate limiting configured.
 */
export function getRouteRateLimitConfig(pathname: string): RouteRateLimitConfig | null {
  // Exact match first
  if (PUBLIC_API_RATE_LIMITS[pathname]) {
    return PUBLIC_API_RATE_LIMITS[pathname];
  }

  // Pattern match for dynamic routes (e.g., /api/transactions/[hash])
  for (const [pattern, config] of Object.entries(PUBLIC_API_RATE_LIMITS)) {
    const regexPattern = pattern
      .replace(/\[.*?\]/g, '[^/]+')
      .replace(/\//g, '\\/');
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(pathname)) {
      return config;
    }
  }

  return null;
}

/**
 * Rate limiting middleware for public API routes.
 * Returns a 429 response if the rate limit is exceeded.
 */
export async function publicApiRateLimitMiddleware(
  request: NextRequest,
  isAuthenticated: boolean = false,
): Promise<NextResponse | null> {
  const pathname = new URL(request.url).pathname;
  const config = getRouteRateLimitConfig(pathname);

  // If no rate limit configured, allow request
  if (!config) {
    return null;
  }

  try {
    const identifier = getClientIdentifier(request, isAuthenticated);
    const key = `ratelimit:${isAuthenticated ? 'auth' : 'anon'}:${pathname}:${identifier}`;

    // Increment and check rate limit
    const count = await globalRateLimitStore.increment(key, config.windowMs);
    const allowed = count <= config.maxRequests;

    // Calculate reset time
    const remaining = Math.max(0, config.maxRequests - count);
    const retryAfterSeconds = Math.ceil(config.windowMs / 1000);

    // Add rate limit headers to response
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': (Date.now() + config.windowMs).toString(),
    };

    if (!allowed) {
      logger.warn('Public API rate limit exceeded', {
        pathname,
        identifier,
        isAuthenticated,
        config,
      });

      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': retryAfterSeconds.toString(),
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // Request allowed - return null to continue processing
    // Note: Rate limit headers will be added by response middleware
    return null;
  } catch (error) {
    logger.error('Public API rate limiting error', { error });
    // On error, allow request to proceed to prevent service disruption
    return null;
  }
}

/**
 * Middleware to add rate limit headers to successful responses.
 */
export function addRateLimitHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const pathname = new URL(request.url).pathname;
  const config = getRouteRateLimitConfig(pathname);

  if (!config) {
    return response;
  }

  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());

  return response;
}

/**
 * Reset rate limit for a specific route and identifier (for testing/admin).
 */
export async function resetPublicApiRateLimit(
  pathname: string,
  identifier: string,
  isAuthenticated: boolean = false,
): Promise<void> {
  const key = `ratelimit:${isAuthenticated ? 'auth' : 'anon'}:${pathname}:${identifier}`;
  await globalRateLimitStore.reset(key);
}

/**
 * Get current rate limit status for debugging.
 */
export async function getPublicApiRateLimitStatus(
  pathname: string,
  identifier: string,
  isAuthenticated: boolean = false,
): Promise<{ current: number; limit: number | null; remaining: number }> {
  const config = getRouteRateLimitConfig(pathname);
  const key = `ratelimit:${isAuthenticated ? 'auth' : 'anon'}:${pathname}:${identifier}`;
  const current = await globalRateLimitStore.get(key);

  return {
    current,
    limit: config?.maxRequests || null,
    remaining: config ? Math.max(0, config.maxRequests - current) : -1,
  };
}
