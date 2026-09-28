import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sessionManagementService } from '@/lib/session-management';
import {
  authenticateApiKey,
  checkApiKeyRateLimit,
} from '@/lib/api-keys';
import type { AuthContext, AuthToken, AuthError } from './types';

/**
 * Unified Authentication Service
 *
 * Consolidates all authentication logic in a single place:
 * - Bearer token (session) validation
 * - API key extraction and validation
 * - Admin token verification
 * - Edge case handling (expired tokens, missing credentials, etc.)
 *
 * Usage in route handlers:
 *   const auth = AuthService.fromRequest(request);
 *   if (!auth.isAuthenticated) {
 *     return AuthService.sendUnauthorized(auth.error);
 *   }
 */

export class AuthService {
  /**
   * Extract and validate authentication from a NextRequest.
   * Does not throw — returns AuthContext with isAuthenticated flag.
   */
  static async fromRequest(request: NextRequest): Promise<AuthContext> {
    const token = this.extractToken(request);

    if (!token) {
      return {
        type: 'none',
        token: null,
        isAuthenticated: false,
      };
    }

    if (token.type === 'bearer') {
      return this.validateBearerToken(token);
    }

    if (token.type === 'api-key') {
      return this.validateApiKey(token);
    }

    return {
      type: 'none',
      token: null,
      isAuthenticated: false,
    };
  }

  /**
   * Extract token from Authorization or x-api-key headers.
   * Returns null if no valid token header found.
   */
  static extractToken(request: NextRequest): AuthToken | null {
    // Check for x-api-key header first
    const xApiKey = request.headers.get('x-api-key');
    if (xApiKey?.trim()) {
      return {
        type: 'api-key',
        value: xApiKey.trim(),
        extractedAt: Date.now(),
      };
    }

    // Check for Authorization: Bearer <token> header
    const authorization = request.headers.get('authorization');
    if (!authorization) return null;

    const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
    if (!bearerMatch) return null;

    return {
      type: 'bearer',
      value: bearerMatch[1],
      extractedAt: Date.now(),
    };
  }

  /**
   * Validate a Bearer token (session token).
   * Checks token validity and expiration.
   */
  static async validateBearerToken(token: AuthToken): Promise<AuthContext> {
    try {
      const session = await sessionManagementService.validateSession(token.value);

      if (!session) {
        logger.warn('session-validation-failed', {
          tokenExtractedAt: token.extractedAt,
        });
        return {
          type: 'session',
          token,
          session: null,
          isAuthenticated: false,
        };
      }

      return {
        type: 'session',
        token,
        session: {
          id: session.id,
          userAddress: session.userAddress,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
          isValid: true,
        },
        isAuthenticated: true,
        userId: session.userAddress,
      };
    } catch (error) {
      logger.error('bearer-token-validation-error', {}, error);
      return {
        type: 'session',
        token,
        session: null,
        isAuthenticated: false,
      };
    }
  }

  /**
   * Validate an API key.
   * Checks key validity, scopes, rate limits, etc.
   */
  static async validateApiKey(token: AuthToken): Promise<AuthContext> {
    try {
      const apiKey = await authenticateApiKey(token.value);

      if (!apiKey) {
        logger.warn('invalid-api-key-attempted', {
          tokenExtractedAt: token.extractedAt,
        });
        return {
          type: 'api-key',
          token,
          isAuthenticated: false,
        };
      }

      const rateLimit = checkApiKeyRateLimit(apiKey);

      if (!rateLimit.allowed) {
        logger.warn('api-key-rate-limit-exceeded', {
          apiKeyId: apiKey.id,
        });
        return {
          type: 'api-key',
          token,
          apiKey: {
            id: apiKey.id,
            keyHash: apiKey.keyHash,
            scopes: apiKey.scopes,
            rateLimit: apiKey.rateLimit,
            isActive: apiKey.isActive,
          },
          isAuthenticated: false,
        };
      }

      return {
        type: 'api-key',
        token,
        apiKey: {
          id: apiKey.id,
          keyHash: apiKey.keyHash,
          scopes: apiKey.scopes,
          rateLimit: apiKey.rateLimit,
          isActive: apiKey.isActive,
        },
        isAuthenticated: true,
      };
    } catch (error) {
      logger.error('api-key-validation-error', {}, error);
      return {
        type: 'api-key',
        token,
        isAuthenticated: false,
      };
    }
  }

  /**
   * Verify admin token from environment.
   * Use for protected admin endpoints.
   */
  static verifyAdminToken(token: string): boolean {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      logger.warn('admin-token-not-configured');
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    return token.length === adminToken.length &&
      Array.from(token).every((char, i) => char === adminToken[i]);
  }

  /**
   * Build a NextResponse for unauthorized access.
   * Includes appropriate status codes and error messages.
   */
  static sendUnauthorized(reason?: string): NextResponse {
    const message = reason || 'Unauthorized';
    return NextResponse.json(
      { error: message },
      { status: 401 },
    );
  }

  /**
   * Build a NextResponse for forbidden access (authenticated but insufficient permissions).
   */
  static sendForbidden(reason?: string): NextResponse {
    const message = reason || 'Forbidden';
    return NextResponse.json(
      { error: message },
      { status: 403 },
    );
  }

  /**
   * Build a NextResponse for rate limit exceeded.
   * Includes Retry-After header if available.
   */
  static sendRateLimited(retryAfter?: number): NextResponse {
    const response = NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 },
    );

    if (retryAfter) {
      response.headers.set('Retry-After', String(retryAfter));
    }

    return response;
  }

  /**
   * Attach authentication context to request headers.
   * Useful for passing auth info to downstream handlers.
   */
  static attachContextHeaders(
    headers: Headers,
    context: AuthContext,
  ): Headers {
    if (context.type === 'session' && context.session) {
      headers.set('x-auth-type', 'session');
      headers.set('x-session-id', context.session.id);
      headers.set('x-user-address', context.session.userAddress);
    }

    if (context.type === 'api-key' && context.apiKey) {
      headers.set('x-auth-type', 'api-key');
      headers.set('x-api-key-id', context.apiKey.id);
    }

    return headers;
  }
}
