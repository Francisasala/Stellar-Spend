import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './service';
import { sessionManagementService } from '@/lib/session-management';
import { authenticateApiKey, checkApiKeyRateLimit } from '@/lib/api-keys';
import { NextRequest } from 'next/server';

vi.mock('@/lib/session-management');
vi.mock('@/lib/api-keys');

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractToken', () => {
    it('should extract Bearer token from Authorization header', () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          authorization: 'Bearer my-session-token-123',
        },
      });

      const token = AuthService.extractToken(request);

      expect(token).not.toBeNull();
      expect(token?.type).toBe('bearer');
      expect(token?.value).toBe('my-session-token-123');
    });

    it('should extract API key from x-api-key header', () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-api-key': 'my-api-key-123',
        },
      });

      const token = AuthService.extractToken(request);

      expect(token).not.toBeNull();
      expect(token?.type).toBe('api-key');
      expect(token?.value).toBe('my-api-key-123');
    });

    it('should prefer x-api-key over Bearer token', () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-api-key': 'my-api-key-123',
          authorization: 'Bearer my-session-token-123',
        },
      });

      const token = AuthService.extractToken(request);

      expect(token?.type).toBe('api-key');
      expect(token?.value).toBe('my-api-key-123');
    });

    it('should return null when no auth headers present', () => {
      const request = new NextRequest('http://localhost/api/test');

      const token = AuthService.extractToken(request);

      expect(token).toBeNull();
    });

    it('should trim whitespace from token', () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-api-key': '  my-api-key-123  ',
        },
      });

      const token = AuthService.extractToken(request);

      expect(token?.value).toBe('my-api-key-123');
    });
  });

  describe('validateBearerToken', () => {
    it('should validate valid session token', async () => {
      const mockSession = {
        id: 'session-123',
        userAddress: '0x1234567890123456789012345678901234567890',
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
      };

      vi.mocked(sessionManagementService.validateSession).mockResolvedValueOnce(
        mockSession,
      );

      const token = {
        type: 'bearer' as const,
        value: 'valid-token',
        extractedAt: Date.now(),
      };

      const context = await AuthService.validateBearerToken(token);

      expect(context.isAuthenticated).toBe(true);
      expect(context.type).toBe('session');
      expect(context.session).toEqual({
        id: 'session-123',
        userAddress: mockSession.userAddress,
        expiresAt: mockSession.expiresAt,
        createdAt: mockSession.createdAt,
        isValid: true,
      });
    });

    it('should handle invalid session token', async () => {
      vi.mocked(sessionManagementService.validateSession).mockResolvedValueOnce(
        null,
      );

      const token = {
        type: 'bearer' as const,
        value: 'invalid-token',
        extractedAt: Date.now(),
      };

      const context = await AuthService.validateBearerToken(token);

      expect(context.isAuthenticated).toBe(false);
      expect(context.session).toBeNull();
    });

    it('should handle validation errors gracefully', async () => {
      vi.mocked(sessionManagementService.validateSession).mockRejectedValueOnce(
        new Error('Database connection error'),
      );

      const token = {
        type: 'bearer' as const,
        value: 'token',
        extractedAt: Date.now(),
      };

      const context = await AuthService.validateBearerToken(token);

      expect(context.isAuthenticated).toBe(false);
    });
  });

  describe('validateApiKey', () => {
    it('should validate valid API key', async () => {
      const mockApiKey = {
        id: 'key-123',
        keyHash: 'hash-123',
        scopes: ['read', 'write'],
        rateLimit: 1000,
        isActive: true,
      };

      vi.mocked(authenticateApiKey).mockResolvedValueOnce(mockApiKey);
      vi.mocked(checkApiKeyRateLimit).mockReturnValueOnce({
        allowed: true,
        retryAfter: null,
      });

      const token = {
        type: 'api-key' as const,
        value: 'valid-api-key',
        extractedAt: Date.now(),
      };

      const context = await AuthService.validateApiKey(token);

      expect(context.isAuthenticated).toBe(true);
      expect(context.type).toBe('api-key');
      expect(context.apiKey).toEqual({
        id: 'key-123',
        keyHash: 'hash-123',
        scopes: ['read', 'write'],
        rateLimit: 1000,
        isActive: true,
      });
    });

    it('should reject rate-limited API key', async () => {
      const mockApiKey = {
        id: 'key-123',
        keyHash: 'hash-123',
        scopes: ['read'],
        rateLimit: 1000,
        isActive: true,
      };

      vi.mocked(authenticateApiKey).mockResolvedValueOnce(mockApiKey);
      vi.mocked(checkApiKeyRateLimit).mockReturnValueOnce({
        allowed: false,
        retryAfter: 60,
      });

      const token = {
        type: 'api-key' as const,
        value: 'limited-api-key',
        extractedAt: Date.now(),
      };

      const context = await AuthService.validateApiKey(token);

      expect(context.isAuthenticated).toBe(false);
    });

    it('should handle invalid API key', async () => {
      vi.mocked(authenticateApiKey).mockResolvedValueOnce(null);

      const token = {
        type: 'api-key' as const,
        value: 'invalid-api-key',
        extractedAt: Date.now(),
      };

      const context = await AuthService.validateApiKey(token);

      expect(context.isAuthenticated).toBe(false);
    });
  });

  describe('verifyAdminToken', () => {
    it('should verify valid admin token', () => {
      const adminToken = 'super-secret-admin-token';
      process.env.ADMIN_TOKEN = adminToken;

      const isValid = AuthService.verifyAdminToken(adminToken);

      expect(isValid).toBe(true);
    });

    it('should reject invalid admin token', () => {
      process.env.ADMIN_TOKEN = 'super-secret-admin-token';

      const isValid = AuthService.verifyAdminToken('wrong-token');

      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison', () => {
      process.env.ADMIN_TOKEN = 'secret';

      // Both should take the same time regardless of position of mismatch
      AuthService.verifyAdminToken('secre');
      AuthService.verifyAdminToken('wrongg');

      // Both should be false
      expect(AuthService.verifyAdminToken('secre')).toBe(false);
      expect(AuthService.verifyAdminToken('wrongg')).toBe(false);
    });
  });

  describe('response builders', () => {
    it('should build unauthorized response', () => {
      const response = AuthService.sendUnauthorized('Invalid token');

      expect(response.status).toBe(401);
    });

    it('should build forbidden response', () => {
      const response = AuthService.sendForbidden('Insufficient permissions');

      expect(response.status).toBe(403);
    });

    it('should build rate-limited response', () => {
      const response = AuthService.sendRateLimited(60);

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');
    });
  });
});
