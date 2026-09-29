# Standard API Error Response Schema

All API endpoints in Stellar-Spend follow a unified error response format. This document defines the standard error response structure and how to use it.

---

## Standard Response Format

### Success (2xx)
```typescript
// Route-specific success response (varies by endpoint)
{
  "data": { /* ... */ }
}
```

### Error (4xx, 5xx)
```typescript
interface StandardErrorResponse {
  /** Machine-readable error code */
  error: ErrorType;
  
  /** Human-readable error description (optional) */
  message?: string;
  
  /** Additional context for debugging (development only) */
  details?: unknown;
}
```

---

## Error Types & HTTP Status Codes

| ErrorType | HTTP Status | Use Case |
|-----------|------------|----------|
| `validation_error` | 400 | Invalid request body, missing required fields, constraints violated |
| `unauthorized` | 401 | Missing/invalid authentication token |
| `forbidden` | 403 | Valid auth but insufficient permissions |
| `not_found` | 404 | Resource does not exist |
| `conflict` | 409 | Invalid state transition, duplicate resource |
| `rate_limit_exceeded` | 429 | Rate limit threshold exceeded |
| `external_service_error` | 502 | Upstream service (Paycrest, Allbridge, Stellar) unavailable |
| `server_error` | 500 | Internal server error |

---

## Error Response Examples

### Validation Error (400)
```json
{
  "error": "validation_error",
  "message": "Validation failed for field: amount",
  "details": {
    "field": "amount",
    "reason": "must be greater than 0"
  }
}
```

### Unauthorized (401)
```json
{
  "error": "unauthorized",
  "message": "Missing or invalid authentication token"
}
```

### Not Found (404)
```json
{
  "error": "not_found",
  "message": "Order not found"
}
```

### Conflict (409)
```json
{
  "error": "conflict",
  "message": "Duplicate order ID - idempotency key already processed",
  "details": {
    "existingOrderId": "ord_abc123"
  }
}
```

### Rate Limited (429)
```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded"
}
```

With Retry-After header:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

### External Service Error (502)
```json
{
  "error": "external_service_error",
  "message": "Paycrest error: Currency conversion unavailable"
}
```

### Server Error (500)
```json
{
  "error": "server_error",
  "message": "Internal server error"
}
```

**Development mode** (NODE_ENV !== production) also includes:
```json
{
  "error": "server_error",
  "message": "Internal server error",
  "details": {
    "stack": "Error: ...\n at ..."
  }
}
```

---

## Using the ErrorHandler in Route Handlers

### 1. Basic Error Handling with `withApiErrorHandling` Wrapper

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandling } from '@/lib/error-handler';
import { ErrorHandler } from '@/lib/error-handler';

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  // Any thrown error automatically caught and standardized
  const data = await request.json();
  
  // Process request...
  
  return NextResponse.json({ success: true });
});
```

### 2. Manual Error Handling with Factory Methods

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ErrorHandler, ApiError, ErrorType } from '@/lib/error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validation error
    if (!body.email) {
      return ErrorHandler.validation('Email is required', 'email');
    }
    
    // Not found error
    const user = await db.users.findById(body.userId);
    if (!user) {
      return ErrorHandler.notFound('User');
    }
    
    // Unauthorized error
    if (!user.isActive) {
      return ErrorHandler.unauthorized('User account is inactive');
    }
    
    // Forbidden error
    if (user.role !== 'admin') {
      return ErrorHandler.forbidden('Only admins can perform this action');
    }
    
    // Conflict error
    const existing = await db.orders.findById(body.orderId);
    if (existing) {
      return ErrorHandler.conflict('Order already exists', { orderId: body.orderId });
    }
    
    // Rate limit error
    if (requestCount > LIMIT) {
      return ErrorHandler.rateLimit('Too many requests', 60); // Retry after 60s
    }
    
    // Success
    return NextResponse.json({ data: result });
    
  } catch (error) {
    return ErrorHandler.handle(error);
  }
}
```

### 3. Throwing ApiError for Specific Error Types

```typescript
import { ApiError, ErrorType } from '@/lib/error-handler';
import { withApiErrorHandling } from '@/lib/error-handler';

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  
  // Throw specific error types that will be automatically caught and formatted
  if (!body.amount) {
    throw ApiError.validation('Amount is required', { field: 'amount' });
  }
  
  const resource = await fetchResource(body.id);
  if (!resource) {
    throw ApiError.notFound('Resource');
  }
  
  if (!isAuthorized(request)) {
    throw ApiError.unauthorized();
  }
  
  if (!hasPermission(request, 'admin')) {
    throw ApiError.forbidden('Requires admin role');
  }
  
  if (isDuplicate(body.id)) {
    throw ApiError.conflict('Duplicate ID', { id: body.id });
  }
  
  if (isRateLimited(request)) {
    throw ApiError.rateLimit('Too many requests', 60);
  }
  
  if (externalServiceFailed) {
    throw ApiError.externalService('Paycrest', 'Rate API unavailable');
  }
  
  // Process...
  return NextResponse.json({ success: true });
});
```

### 4. ErrorHandler Factory Methods Reference

```typescript
// Validation error (400)
ErrorHandler.validation(message: string, field?: string)

// Not found error (404)
ErrorHandler.notFound(resource?: string)

// Unauthorized error (401)
ErrorHandler.unauthorized(message?: string)

// Forbidden error (403)
ErrorHandler.forbidden(message?: string)

// Conflict error (409)
ErrorHandler.conflict(message: string, details?: Record<string, unknown>)

// Rate limit error (429)
ErrorHandler.rateLimit(message?: string, retryAfter?: number)

// Server error (500)
ErrorHandler.serverError(error?: unknown)

// Timeout error (504)
ErrorHandler.timeout(error: TimeoutError)

// Generic error handler
ErrorHandler.handle(error: unknown, statusCode?: number)
```

---

## ApiError Factory Methods Reference

```typescript
import { ApiError } from '@/lib/error-handler';

// Validation error (400)
throw ApiError.validation(message: string, details?: Record<string, unknown>)

// Not found error (404)
throw ApiError.notFound(resource?: string)

// Unauthorized error (401)
throw ApiError.unauthorized(message?: string)

// Forbidden error (403)
throw ApiError.forbidden(message?: string)

// Conflict error (409)
throw ApiError.conflict(message: string, details?: Record<string, unknown>)

// Rate limit error (429)
throw ApiError.rateLimit(message?: string, retryAfter?: number)

// External service error (502)
throw ApiError.externalService(service: string, message: string)

// Server error (500)
throw ApiError.server(message?: string)
```

---

## Best Practices

### 1. Choose the Right Error Type
- Use `validation_error` for input validation failures
- Use `not_found` for missing resources
- Use `unauthorized` for authentication failures
- Use `forbidden` for authorization failures
- Use `conflict` for invalid state transitions or duplicates
- Use `external_service_error` for upstream API failures
- Use `server_error` only for unexpected internal failures

### 2. Prefer ApiError Over Manual ErrorHandler Calls
```typescript
// ✅ Good - clear, throw-able error
throw ApiError.validation('Email is required');

// ✅ Acceptable - explicit return for client validation logic
if (!email) {
  return ErrorHandler.validation('Email is required', 'email');
}

// ❌ Avoid - inconsistent response shape
return NextResponse.json({ error: 'Email is required' }, { status: 400 });
```

### 3. Include Helpful Details (Development Only)
```typescript
// Details are automatically stripped in production
return ErrorHandler.conflict('Duplicate order', {
  orderId: existingOrder.id,
  createdAt: existingOrder.createdAt,
  existingAmount: existingOrder.amount,
});
```

### 4. Use `withApiErrorHandling` Wrapper for Cleaner Code
```typescript
// ✅ Clean - errors automatically caught and standardized
export const POST = withApiErrorHandling(async (req) => {
  const data = await riskyOperation();
  return NextResponse.json({ success: true });
});

// ✅ Also fine - explicit error handling when needed
export const POST = withApiErrorHandling(async (req) => {
  if (!isAuthorized(req)) {
    throw ApiError.unauthorized();
  }
  return NextResponse.json({ success: true });
});
```

### 5. Handle Specific Error Types
```typescript
try {
  // Operation that might fail in specific ways
  await paycrestClient.getQuote(currency);
} catch (error) {
  if (error instanceof TimeoutError) {
    return ErrorHandler.timeout(error);
  }
  
  if (error instanceof PaycrestHttpError) {
    return ErrorHandler.handle(error);
  }
  
  return ErrorHandler.serverError(error);
}
```

---

## Testing Error Responses

### Unit Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { POST } from './route';

describe('POST /api/example', () => {
  it('returns validation_error when email is missing', async () => {
    const req = new Request('http://localhost/api/example', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    
    const res = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.error).toBe('validation_error');
    expect(data.message).toContain('email');
  });

  it('returns not_found when resource does not exist', async () => {
    const req = new Request('http://localhost/api/example', {
      method: 'POST',
      body: JSON.stringify({ id: 'nonexistent' }),
    });
    
    const res = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(404);
    expect(data.error).toBe('not_found');
  });
});
```

### Integration Test Example
```typescript
import { describe, it, expect } from 'vitest';

describe('Error Response Consistency', () => {
  const endpoints = [
    'POST /api/offramp/quote',
    'GET /api/offramp/currencies',
    'POST /api/offramp/order',
  ];
  
  endpoints.forEach((endpoint) => {
    it(`${endpoint} returns StandardErrorResponse on validation error`, async () => {
      const res = await request(endpoint).send({});
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('message');
      // Should not have other random fields
      expect(Object.keys(res.body).sort()).toEqual(['error', 'message']);
    });
  });
});
```

---

## Migration from Ad Hoc Error Responses

### Before (Inconsistent)
```typescript
// Different shapes across endpoints
return NextResponse.json({ error: 'Email required' }, { status: 400 });
return NextResponse.json({ valid: false, error: 'Invalid currency' });
return NextResponse.json({ errorCode: 'NOT_FOUND' }, { status: 404 });
```

### After (Standardized)
```typescript
// All endpoints use the same shape
return ErrorHandler.validation('Email required', 'email');
return ErrorHandler.validation('Invalid currency');
return ErrorHandler.notFound('Currency');
```

---

## Frequently Asked Questions

**Q: Should I use ErrorHandler methods or throw ApiError?**  
A: Either works. Use `throw ApiError.*` for cleaner throw-based logic. Use `ErrorHandler.*` when returning errors conditionally without throwing.

**Q: How do I add custom fields to error responses?**  
A: Use the `details` parameter (development environments only):
```typescript
return ErrorHandler.conflict('Order exists', { 
  existingOrderId: order.id,
  createdAt: order.createdAt,
});
```

**Q: Are error details exposed in production?**  
A: No. The `details` field is automatically stripped when `NODE_ENV === 'production'`.

**Q: What HTTP status code should I use for an unknown error?**  
A: Use 500 (server_error). The ErrorHandler will classify unknown errors as `server_error`.

**Q: Can I customize error messages for specific locales?**  
A: Yes, the `message` field is meant for user-facing text and can be localized by the client using the `error` code as a key.

