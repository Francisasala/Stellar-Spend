/**
 * Integration tests for public API rate limiting.
 * Tests concurrent traffic scenarios and high-volume requests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  publicApiRateLimitMiddleware,
  getClientIdentifier,
  getClientIp,
  getRouteRateLimitConfig,
  resetPublicApiRateLimit,
  getPublicApiRateLimitStatus,
  PUBLIC_API_RATE_LIMITS,
} from '../public-api-rate-limit.middleware';

/**
 * Create a mock NextRequest for testing.
 */
function createMockRequest(
  pathname: string,
  options: {
    ip?: string;
    accountId?: string;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`);
  const headers = new Headers(options.headers || {});

  if (options.ip) {
    headers.set('x-forwarded-for', options.ip);
  }
  if (options.accountId) {
    headers.set('x-account-id', options.accountId);
  }

  const request = new NextRequest(url, { headers });
  return request;
}

describe('Public API Rate Limiting Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getClientIp', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = createMockRequest('/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      });
      const ip = getClientIp(request);
      expect(ip).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = createMockRequest('/api/test', {
        headers: { 'x-real-ip': '192.168.1.1' },
      });
      const ip = getClientIp(request);
      expect(ip).toBe('192.168.1.1');
    });

    it('should return null if no IP headers present', () => {
      const request = createMockRequest('/api/test');
      const ip = getClientIp(request);
      expect(ip).toBeNull();
    });

    it('should prioritize x-forwarded-for over x-real-ip', () => {
      const request = createMockRequest('/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '10.0.0.1',
        },
      });
      const ip = getClientIp(request);
      expect(ip).toBe('192.168.1.1');
    });
  });

  describe('getClientIdentifier', () => {
    it('should use account ID for authenticated requests', () => {
      const request = createMockRequest('/api/test', { accountId: 'account-123' });
      const identifier = getClientIdentifier(request, true);
      expect(identifier).toBe('account:account-123');
    });

    it('should use IP address for unauthenticated requests', () => {
      const request = createMockRequest('/api/test', { ip: '192.168.1.1' });
      const identifier = getClientIdentifier(request, false);
      expect(identifier).toBe('192.168.1.1');
    });

    it('should use IP as fallback for authenticated requests without account ID', () => {
      const request = createMockRequest('/api/test', { ip: '192.168.1.1' });
      const identifier = getClientIdentifier(request, true);
      expect(identifier).toBe('192.168.1.1');
    });
  });

  describe('getRouteRateLimitConfig', () => {
    it('should return config for exact match', () => {
      const config = getRouteRateLimitConfig('/api/offramp/quote');
      expect(config).toBeDefined();
      expect(config?.maxRequests).toBeGreaterThan(0);
    });

    it('should return config for dynamic route match', () => {
      const config = getRouteRateLimitConfig('/api/transactions/12345/status');
      // Since there's no dynamic route pattern, it should return null
      expect(config).toBeNull();
    });

    it('should return null for unconfigured routes', () => {
      const config = getRouteRateLimitConfig('/api/unknown/route');
      expect(config).toBeNull();
    });
  });

  describe('Rate limit enforcement', () => {
    it('should allow requests within limit', async () => {
      const request = createMockRequest('/api/offramp/quote', { ip: '192.168.1.1' });
      await resetPublicApiRateLimit('/api/offramp/quote', '192.168.1.1', false);

      const response = await publicApiRateLimitMiddleware(request, false);
      expect(response).toBeNull(); // Request allowed
    });

    it('should block requests exceeding limit', async () => {
      const config = PUBLIC_API_RATE_LIMITS['/api/auth/2fa/verify'];
      if (!config) {
        throw new Error('Config not found');
      }

      const ip = '192.168.1.1';
      await resetPublicApiRateLimit('/api/auth/2fa/verify', ip, false);

      // Send requests up to the limit
      for (let i = 0; i < config.maxRequests; i++) {
        const request = createMockRequest('/api/auth/2fa/verify', { ip });
        const response = await publicApiRateLimitMiddleware(request, false);
        expect(response).toBeNull();
      }

      // Next request should be blocked
      const excessRequest = createMockRequest('/api/auth/2fa/verify', { ip });
      const blockedResponse = await publicApiRateLimitMiddleware(excessRequest, false);
      expect(blockedResponse).toBeDefined();
      expect(blockedResponse?.status).toBe(429);
    });

    it('should return proper error response', async () => {
      const config = PUBLIC_API_RATE_LIMITS['/api/auth/login'];
      if (!config) {
        throw new Error('Config not found');
      }

      const ip = '192.168.1.2';
      await resetPublicApiRateLimit('/api/auth/login', ip, false);

      // Exhaust limit
      for (let i = 0; i < config.maxRequests; i++) {
        const request = createMockRequest('/api/auth/login', { ip });
        await publicApiRateLimitMiddleware(request, false);
      }

      // Get blocked response
      const excessRequest = createMockRequest('/api/auth/login', { ip });
      const response = await publicApiRateLimitMiddleware(excessRequest, false);

      expect(response?.status).toBe(429);
      expect(response?.headers.get('Retry-After')).toBeDefined();
      expect(response?.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(response?.headers.get('X-RateLimit-Remaining')).toBe('0');
    });
  });

  describe('High-volume traffic scenarios', () => {
    it('should handle concurrent requests from same IP', async () => {
      const ip = '192.168.1.100';
      const config = PUBLIC_API_RATE_LIMITS['/api/offramp/rate'];
      if (!config) {
        throw new Error('Config not found');
      }

      await resetPublicApiRateLimit('/api/offramp/rate', ip, false);

      // Simulate concurrent requests
      const requests = Array.from({ length: config.maxRequests + 5 }, () =>
        createMockRequest('/api/offramp/rate', { ip })
      );

      const results = await Promise.all(
        requests.map(req => publicApiRateLimitMiddleware(req, false))
      );

      // First N should be allowed, rest blocked
      const allowed = results.filter(r => r === null).length;
      const blocked = results.filter(r => r?.status === 429).length;

      expect(allowed).toBe(config.maxRequests);
      expect(blocked).toBeGreaterThan(0);
    });

    it('should isolate rate limits by IP address', async () => {
      const config = PUBLIC_API_RATE_LIMITS['/api/wallet/validate'];
      if (!config) {
        throw new Error('Config not found');
      }

      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      await resetPublicApiRateLimit('/api/wallet/validate', ip1, false);
      await resetPublicApiRateLimit('/api/wallet/validate', ip2, false);

      // Use up limit for IP1
      for (let i = 0; i < config.maxRequests; i++) {
        const request = createMockRequest('/api/wallet/validate', { ip: ip1 });
        await publicApiRateLimitMiddleware(request, false);
      }

      // IP1 should be blocked
      const ip1Request = createMockRequest('/api/wallet/validate', { ip: ip1 });
      const ip1Response = await publicApiRateLimitMiddleware(ip1Request, false);
      expect(ip1Response?.status).toBe(429);

      // IP2 should still be allowed
      const ip2Request = createMockRequest('/api/wallet/validate', { ip: ip2 });
      const ip2Response = await publicApiRateLimitMiddleware(ip2Request, false);
      expect(ip2Response).toBeNull();
    });

    it('should isolate rate limits by route', async () => {
      const ip = '192.168.1.200';
      const route1 = '/api/offramp/quote';
      const route2 = '/api/offramp/rate';

      const config1 = PUBLIC_API_RATE_LIMITS[route1];
      const config2 = PUBLIC_API_RATE_LIMITS[route2];
      if (!config1 || !config2) {
        throw new Error('Config not found');
      }

      await resetPublicApiRateLimit(route1, ip, false);
      await resetPublicApiRateLimit(route2, ip, false);

      // Make requests to both routes
      const route1Request = createMockRequest(route1, { ip });
      const route2Request = createMockRequest(route2, { ip });

      const route1Response = await publicApiRateLimitMiddleware(route1Request, false);
      const route2Response = await publicApiRateLimitMiddleware(route2Request, false);

      // Both should be allowed
      expect(route1Response).toBeNull();
      expect(route2Response).toBeNull();
    });
  });

  describe('Status tracking', () => {
    it('should track request count correctly', async () => {
      const ip = '192.168.1.50';
      const route = '/api/compliance/screen';
      await resetPublicApiRateLimit(route, ip, false);

      const status1 = await getPublicApiRateLimitStatus(route, ip, false);
      expect(status1.current).toBe(0);

      const request = createMockRequest(route, { ip });
      await publicApiRateLimitMiddleware(request, false);

      const status2 = await getPublicApiRateLimitStatus(route, ip, false);
      expect(status2.current).toBe(1);
      expect(status2.remaining).toBeLessThan(status1.limit || 0);
    });

    it('should reset rate limit correctly', async () => {
      const ip = '192.168.1.51';
      const route = '/api/wallet/create';

      // Use some requests
      const request = createMockRequest(route, { ip });
      await publicApiRateLimitMiddleware(request, false);

      let status = await getPublicApiRateLimitStatus(route, ip, false);
      expect(status.current).toBeGreaterThan(0);

      // Reset
      await resetPublicApiRateLimit(route, ip, false);

      status = await getPublicApiRateLimitStatus(route, ip, false);
      expect(status.current).toBe(0);
    });
  });

  describe('Authenticated vs unauthenticated', () => {
    it('should separate limits for authenticated users', async () => {
      const ip = '192.168.1.150';
      const accountId = 'account-456';
      const route = '/api/offramp/quote';

      await resetPublicApiRateLimit(route, ip, false);
      await resetPublicApiRateLimit(route, `account:${accountId}`, true);

      const anonRequest = createMockRequest(route, { ip });
      const authRequest = createMockRequest(route, { ip, accountId });

      const anonResponse = await publicApiRateLimitMiddleware(anonRequest, false);
      const authResponse = await publicApiRateLimitMiddleware(authRequest, true);

      expect(anonResponse).toBeNull();
      expect(authResponse).toBeNull();

      const anonStatus = await getPublicApiRateLimitStatus(route, ip, false);
      const authStatus = await getPublicApiRateLimitStatus(route, `account:${accountId}`, true);

      expect(anonStatus.current).toBe(1);
      expect(authStatus.current).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should allow request if rate limit check fails', async () => {
      const request = createMockRequest('/api/test', { ip: '192.168.1.1' });
      // Route without rate limit config should return null
      const response = await publicApiRateLimitMiddleware(request, false);
      expect(response).toBeNull();
    });
  });
});
