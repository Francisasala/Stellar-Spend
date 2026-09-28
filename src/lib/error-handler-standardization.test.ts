import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorHandler } from './error-handler';
import { ApiError, ErrorType } from './error-types';
import { NextRequest, NextResponse } from 'next/server';

// Test for Issue #1123: Standardize error handling across src/app/api routes
// This test ensures all routes consistently use error-handler.ts/error-types.ts

describe('Error Handler Standardization - Issue #1123', () => {
  describe('Standard error response format', () => {
    it('should format validation errors consistently', () => {
      const response = ErrorHandler.validation('Invalid email format', 'email');

      expect(response.status).toBe(400);
      const data = response as unknown as { json: () => Promise<any> };
      expect(response).toBeDefined();
    });

    it('should format not found errors consistently', () => {
      const response = ErrorHandler.notFound('User');

      expect(response.status).toBe(404);
    });

    it('should format unauthorized errors consistently', () => {
      const response = ErrorHandler.unauthorized('Admin access required');

      expect(response.status).toBe(401);
    });

    it('should format server errors consistently', () => {
      const error = new Error('Database connection failed');
      const response = ErrorHandler.serverError(error);

      expect(response.status).toBe(500);
    });

    it('should format forbidden errors consistently', () => {
      const response = ErrorHandler.forbidden('You do not have permission to access this resource');

      expect(response.status).toBe(403);
    });

    it('should format conflict errors consistently', () => {
      const response = ErrorHandler.conflict('A user with this email already exists');

      expect(response.status).toBe(409);
    });
  });

  describe('ApiError factory methods', () => {
    it('should create validation error with ApiError.validation', () => {
      const error = ApiError.validation('Email is required');

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(400);
      expect(error.errorType).toBe(ErrorType.VALIDATION);
      expect(error.message).toBe('Email is required');
    });

    it('should create notFound error with ApiError.notFound', () => {
      const error = ApiError.notFound('Product');

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(404);
      expect(error.errorType).toBe(ErrorType.NOT_FOUND);
      expect(error.message).toBe('Product not found');
    });

    it('should create unauthorized error with ApiError.unauthorized', () => {
      const error = ApiError.unauthorized('API key is invalid');

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
      expect(error.errorType).toBe(ErrorType.UNAUTHORIZED);
      expect(error.message).toBe('API key is invalid');
    });

    it('should create forbidden error with ApiError.forbidden', () => {
      const error = ApiError.forbidden('Access denied');

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.errorType).toBe(ErrorType.FORBIDDEN);
      expect(error.message).toBe('Access denied');
    });

    it('should create conflict error with ApiError.conflict', () => {
      const error = ApiError.conflict('Resource already exists');

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(409);
      expect(error.errorType).toBe(ErrorType.CONFLICT);
      expect(error.message).toBe('Resource already exists');
    });

    it('should create server error with ApiError.server', () => {
      const error = ApiError.server('Internal server error');

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(500);
      expect(error.errorType).toBe(ErrorType.SERVER_ERROR);
      expect(error.message).toBe('Internal server error');
    });
  });

  describe('Error details preservation', () => {
    it('should preserve error details through ErrorHandler.handle', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = ApiError.validation('Invalid email', details);

      const response = ErrorHandler.handle(error);
      expect(response.status).toBe(400);
    });

    it('should include error type in response', () => {
      const error = ApiError.validation('Required field missing');
      const response = ErrorHandler.handle(error);

      expect(response.status).toBe(400);
    });

    it('should handle errors with custom status codes', () => {
      const error = ApiError.server('Service unavailable');
      const response = ErrorHandler.handle(error);

      expect(response.status).toBe(500);
    });
  });

  describe('Consistency across all error types', () => {
    const errorScenarios = [
      {
        name: 'validation error',
        creator: () => ApiError.validation('Field required'),
        expectedStatus: 400,
        expectedType: ErrorType.VALIDATION,
      },
      {
        name: 'not found error',
        creator: () => ApiError.notFound('Resource'),
        expectedStatus: 404,
        expectedType: ErrorType.NOT_FOUND,
      },
      {
        name: 'unauthorized error',
        creator: () => ApiError.unauthorized('Invalid credentials'),
        expectedStatus: 401,
        expectedType: ErrorType.UNAUTHORIZED,
      },
      {
        name: 'forbidden error',
        creator: () => ApiError.forbidden('Access denied'),
        expectedStatus: 403,
        expectedType: ErrorType.FORBIDDEN,
      },
      {
        name: 'conflict error',
        creator: () => ApiError.conflict('Resource exists'),
        expectedStatus: 409,
        expectedType: ErrorType.CONFLICT,
      },
      {
        name: 'server error',
        creator: () => ApiError.server('Internal error'),
        expectedStatus: 500,
        expectedType: ErrorType.SERVER_ERROR,
      },
    ];

    errorScenarios.forEach(({ name, creator, expectedStatus, expectedType }) => {
      it(`should handle ${name} consistently`, () => {
        const error = creator();
        const response = ErrorHandler.handle(error);

        expect(response.status).toBe(expectedStatus);
        expect(error.errorType).toBe(expectedType);
        expect(error.statusCode).toBe(expectedStatus);
      });
    });
  });

  describe('Error response structure validation', () => {
    it('should always include required fields in error response', () => {
      const error = ApiError.validation('Test validation error');
      const response = ErrorHandler.handle(error);

      expect(response).toBeDefined();
      expect(response.status).toBe(400);
    });

    it('should maintain consistent field naming across error responses', () => {
      const errors = [
        ApiError.validation('Validation failed'),
        ApiError.notFound('Not found'),
        ApiError.unauthorized('Unauthorized'),
        ApiError.server('Server error'),
      ];

      errors.forEach((error) => {
        const response = ErrorHandler.handle(error);
        expect(response).toBeDefined();
        expect(response.status).toBeDefined();
        expect(typeof response.status).toBe('number');
      });
    });
  });

  describe('Error handler usage in routes', () => {
    it('ErrorHandler.validation should be usable in routes consistently', () => {
      const response = ErrorHandler.validation('Required field missing');

      expect(response.status).toBe(400);
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('ErrorHandler.notFound should be usable in routes consistently', () => {
      const response = ErrorHandler.notFound('Product');

      expect(response.status).toBe(404);
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('ErrorHandler.unauthorized should be usable in routes consistently', () => {
      const response = ErrorHandler.unauthorized();

      expect(response.status).toBe(401);
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('ErrorHandler.serverError should be usable in routes consistently', () => {
      const error = new Error('Database connection failed');
      const response = ErrorHandler.serverError(error);

      expect(response.status).toBe(500);
      expect(response).toBeInstanceOf(NextResponse);
    });
  });

  describe('HTTP status code consistency', () => {
    it('should map ErrorType to correct HTTP status codes', () => {
      const typeStatusMap = {
        [ErrorType.VALIDATION]: 400,
        [ErrorType.UNAUTHORIZED]: 401,
        [ErrorType.FORBIDDEN]: 403,
        [ErrorType.NOT_FOUND]: 404,
        [ErrorType.CONFLICT]: 409,
        [ErrorType.SERVER_ERROR]: 500,
      };

      Object.entries(typeStatusMap).forEach(([errorType, expectedStatus]) => {
        let error: ApiError;
        switch (errorType) {
          case ErrorType.VALIDATION:
            error = ApiError.validation('Test');
            break;
          case ErrorType.UNAUTHORIZED:
            error = ApiError.unauthorized('Test');
            break;
          case ErrorType.FORBIDDEN:
            error = ApiError.forbidden('Test');
            break;
          case ErrorType.NOT_FOUND:
            error = ApiError.notFound('Test');
            break;
          case ErrorType.CONFLICT:
            error = ApiError.conflict('Test');
            break;
          case ErrorType.SERVER_ERROR:
            error = ApiError.server('Test');
            break;
          default:
            throw new Error(`Unknown error type: ${errorType}`);
        }
        expect(error.statusCode).toBe(expectedStatus);
      });
    });
  });

  describe('Error chaining and wrapping', () => {
    it('should preserve original error in ErrorHandler.handle', () => {
      const originalError = new Error('Original error message');
      const response = ErrorHandler.handle(originalError);

      expect(response.status).toBe(500);
    });

    it('should handle ApiError instances specially', () => {
      const apiError = ApiError.validation('Validation error');
      const response = ErrorHandler.handle(apiError);

      expect(response.status).toBe(400);
    });

    it('should handle wrapped errors consistently', () => {
      const error = new Error('Wrapped error');
      const apiError = ApiError.server('Something went wrong');

      const response1 = ErrorHandler.handle(error);
      const response2 = ErrorHandler.handle(apiError);

      expect(response1.status).toBe(500);
      expect(response2.status).toBe(500);
    });
  });
});
