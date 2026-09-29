# Error Handler Migration Guide for Developers

This guide helps developers migrate existing routes to use the unified error handler and understand how to implement error handling in new routes.

---

## Quick Reference

### Before (Inconsistent)
```typescript
// ❌ Problem: Different error shapes across routes
export async function GET(req: NextRequest) {
  if (!req.headers.get('authorization')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!param) {
    return NextResponse.json({ errorCode: 'MISSING_PARAM' }, { status: 400 });
  }
  
  try {
    // ...
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

### After (Standardized)
```typescript
// ✅ Solution: Unified error handling
export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get('authorization')) {
      return ErrorHandler.unauthorized();
    }
    
    if (!param) {
      return ErrorHandler.validation('Missing param', 'param');
    }
    
    // ...
  } catch (error) {
    return ErrorHandler.handle(error);
  }
}

// Or even cleaner with withApiErrorHandling:
export const GET = withApiErrorHandling(async (req: NextRequest) => {
  if (!req.headers.get('authorization')) {
    throw ApiError.unauthorized();
  }
  
  if (!param) {
    throw ApiError.validation('Missing param');
  }
  
  // ...
});
```

---

## Migration Steps

### Step 1: Identify Ad Hoc Error Responses

Look for these patterns in your route handler:

```typescript
// ❌ Pattern 1: Direct NextResponse.json with error field
return NextResponse.json({ error: 'Something failed' }, { status: 400 });

// ❌ Pattern 2: Mixed error shapes
return NextResponse.json({ valid: false, error: 'Invalid' });
return NextResponse.json({ errorCode: 'NOT_FOUND' }, { status: 404 });

// ❌ Pattern 3: Unstructured error handling
} catch (error) {
  return NextResponse.json({ error: String(error) }, { status: 500 });
}
```

### Step 2: Choose Your Approach

**Option A: Minimal Changes (Keep conditional returns)**
```typescript
import { ErrorHandler } from '@/lib/error-handler';

export async function POST(req: NextRequest) {
  if (!auth) {
    return ErrorHandler.unauthorized();  // ← Use factory methods
  }
  
  if (!validated) {
    return ErrorHandler.validation('Invalid input', 'field');
  }
  
  try {
    // logic
  } catch (error) {
    return ErrorHandler.handle(error);  // ← Catch-all at bottom
  }
}
```

**Option B: Cleaner Code (Use withApiErrorHandling wrapper)**
```typescript
import { withApiErrorHandling, ApiError } from '@/lib/error-handler';

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  if (!auth) {
    throw ApiError.unauthorized();  // ← Throw, don't return
  }
  
  if (!validated) {
    throw ApiError.validation('Invalid input');
  }
  
  // logic
  return NextResponse.json({ success: true });
  // Errors are automatically caught and formatted
});
```

### Step 3: Replace Error Returns

Use this mapping to choose the right ErrorHandler method:

| Your Current Code | Error Type | Migration |
|---|---|---|
| `{ status: 400, error: '...' }` | Input validation | `ErrorHandler.validation(msg, field?)` |
| `{ status: 401, error: '...' }` | Authentication | `ErrorHandler.unauthorized(msg?)` |
| `{ status: 403, error: '...' }` | Authorization | `ErrorHandler.forbidden(msg?)` |
| `{ status: 404, error: '...' }` | Resource not found | `ErrorHandler.notFound(resource?)` |
| `{ status: 409, error: '...' }` | Conflict/duplicate | `ErrorHandler.conflict(msg, details?)` |
| `{ status: 429, error: '...' }` | Rate limit | `ErrorHandler.rateLimit(msg?, retryAfter?)` |
| `{ status: 502, error: '...' }` | External service | `ApiError.externalService(service, msg)` |
| `{ status: 500, error: '...' }` | Server error | `ErrorHandler.serverError(error?)` |

### Step 4: Update Tests

**Before:**
```typescript
const res = await POST(mockRequest);
const data = await res.json();
expect(res.status).toBe(400);
expect(data.error).toBe('Email required');
// Tests had to handle different response shapes
```

**After:**
```typescript
const res = await POST(mockRequest);
const data = await res.json();
expect(res.status).toBe(400);
expect(data.error).toBe('validation_error');
expect(data.message).toBe('Email required');
// Consistent shape across all routes
```

---

## Common Migration Patterns

### Pattern 1: Validation Errors

**Before:**
```typescript
if (!body.email) {
  return NextResponse.json(
    { error: 'Email is required' },
    { status: 400 }
  );
}
```

**After:**
```typescript
if (!body.email) {
  return ErrorHandler.validation('Email is required', 'email');
  // or with ApiError + withApiErrorHandling:
  // throw ApiError.validation('Email is required');
}
```

### Pattern 2: Not Found Errors

**Before:**
```typescript
const user = await db.users.findById(id);
if (!user) {
  return NextResponse.json(
    { error: 'User not found' },
    { status: 404 }
  );
}
```

**After:**
```typescript
const user = await db.users.findById(id);
if (!user) {
  return ErrorHandler.notFound('User');
  // or:
  // throw ApiError.notFound('User');
}
```

### Pattern 3: Authentication Errors

**Before:**
```typescript
const authHeader = req.headers.get('authorization');
if (!authHeader) {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}
```

**After:**
```typescript
const authHeader = req.headers.get('authorization');
if (!authHeader) {
  return ErrorHandler.unauthorized();
  // or:
  // throw ApiError.unauthorized();
}
```

### Pattern 4: External Service Errors

**Before:**
```typescript
try {
  const quote = await paycrestClient.getQuote(currency);
} catch {
  return NextResponse.json(
    { error: 'Failed to get quote' },
    { status: 502 }
  );
}
```

**After:**
```typescript
try {
  const quote = await paycrestClient.getQuote(currency);
} catch (error) {
  return ErrorHandler.handle(
    ApiError.externalService('Paycrest', 'Failed to get quote')
  );
  // or with withApiErrorHandling:
  // throw ApiError.externalService('Paycrest', 'Failed to get quote');
}
```

### Pattern 5: Catch-all Error Handler

**Before:**
```typescript
try {
  // operation
} catch (error) {
  console.error('Error:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

**After:**
```typescript
try {
  // operation
} catch (error) {
  logger.error('Error:', {}, error);
  return ErrorHandler.handle(error);
}

// Or use withApiErrorHandling wrapper to skip try/catch entirely
```

---

## Step-by-Step Migration Example

### Original Route (with issues)
```typescript
// ❌ Inconsistent error responses
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: 'Missing required fields', fields: ['email', 'password'] },
      { status: 400 }
    );
  }
  
  if (!isValidEmail(body.email)) {
    return NextResponse.json(
      { error: 'Invalid email format' },
      { status: 400 }
    );
  }
  
  try {
    const user = await db.users.findByEmail(body.email);
    if (user) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }
    
    const newUser = await db.users.create(body);
    return NextResponse.json({ user: newUser });
  } catch (error) {
    console.error('User creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create user', details: String(error) },
      { status: 500 }
    );
  }
}
```

### Migrated Route (Option A: Minimal changes)
```typescript
// ✅ Using ErrorHandler factory methods
import { NextRequest, NextResponse } from 'next/server';
import { ErrorHandler, ApiError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  if (!body.email || !body.password) {
    return ErrorHandler.validation('Missing required fields', 'email');
  }
  
  if (!isValidEmail(body.email)) {
    return ErrorHandler.validation('Invalid email format', 'email');
  }
  
  try {
    const user = await db.users.findByEmail(body.email);
    if (user) {
      return ErrorHandler.conflict('User already exists', { email: body.email });
    }
    
    const newUser = await db.users.create(body);
    return NextResponse.json({ user: newUser });
  } catch (error) {
    logger.error('User creation failed:', {}, error);
    return ErrorHandler.handle(error);
  }
}
```

### Migrated Route (Option B: Clean wrapper)
```typescript
// ✅ Using withApiErrorHandling + throwing errors
import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandling, ApiError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const body = await req.json();
  
  if (!body.email || !body.password) {
    throw ApiError.validation('Missing required fields');
  }
  
  if (!isValidEmail(body.email)) {
    throw ApiError.validation('Invalid email format', { field: 'email' });
  }
  
  const user = await db.users.findByEmail(body.email);
  if (user) {
    throw ApiError.conflict('User already exists', { email: body.email });
  }
  
  const newUser = await db.users.create(body);
  return NextResponse.json({ user: newUser });
});
```

---

## Response Format Comparison

### The New Standard Response

All errors now return this consistent shape:

```typescript
interface StandardErrorResponse {
  error: string;           // Machine-readable error code
  message?: string;        // Human-readable message
  details?: unknown;       // Debug info (dev only)
}
```

### Examples

**Validation Error (400)**
```json
{
  "error": "validation_error",
  "message": "Invalid email format",
  "details": {
    "field": "email",
    "reason": "Must be a valid email"
  }
}
```

**Unauthorized (401)**
```json
{
  "error": "unauthorized",
  "message": "Missing authentication token"
}
```

**Not Found (404)**
```json
{
  "error": "not_found",
  "message": "User not found"
}
```

**Conflict (409)**
```json
{
  "error": "conflict",
  "message": "User already exists",
  "details": {
    "email": "test@example.com"
  }
}
```

**Server Error (500)**
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

## Checklist for Migration

When migrating a route, verify:

- [ ] All error responses use `ErrorHandler` or throw `ApiError`
- [ ] No direct `NextResponse.json({ error: ... })` calls remain
- [ ] Try/catch blocks end with `ErrorHandler.handle(error)`
- [ ] Appropriate error type is used (validation, notFound, unauthorized, etc.)
- [ ] Error messages are user-facing (no stack traces in message field)
- [ ] Details field only contains non-sensitive information
- [ ] Tests expect `{ error, message?, details? }` shape
- [ ] Status codes match error types (400→validation, 401→unauthorized, etc.)
- [ ] External service errors use `ApiError.externalService()`

---

## FAQ

**Q: Should I wrap all routes with `withApiErrorHandling`?**  
A: It's recommended but not required. Use it for cleaner code. For routes that need custom error handling, manually call `ErrorHandler` methods.

**Q: How do I preserve HTTP status codes from external APIs?**  
A: Use `ErrorHandler.handle(error, statusCode)` or construct ApiError with the desired status. For Paycrest errors, they're already handled correctly.

**Q: Can I add custom fields to error responses?**  
A: Yes, use the `details` parameter (development only):
```typescript
return ErrorHandler.conflict('Order exists', {
  existingOrderId: order.id,
  retryAt: order.nextAvailableTime,
});
```

**Q: Are error details exposed in production?**  
A: No. The `details` field is automatically stripped in production (`NODE_ENV === 'production'`).

**Q: What if I need different error messages for clients vs logs?**  
A: Log the full error, pass a sanitized message to ErrorHandler:
```typescript
try {
  // operation
} catch (error) {
  logger.error('Full error context:', { userId, orderId }, error);
  return ErrorHandler.handle(
    ApiError.server('Unable to process order. Please try again.')
  );
}
```

---

## Resources

- **Schema**: [docs/api/ERROR_RESPONSES.md](./ERROR_RESPONSES.md)
- **Audit Report**: [ERROR_HANDLER_AUDIT.md](../ERROR_HANDLER_AUDIT.md)
- **Error Handler API**: `src/lib/error-handler.ts`
- **Error Types**: `src/lib/error-types.ts`

---

## Support

For questions or issues with migration:
1. Review the examples in `ERROR_RESPONSES.md`
2. Check migrated routes (quote, currencies, transactions, cron, offramp/status)
3. Open an issue with the specific route or error scenario

