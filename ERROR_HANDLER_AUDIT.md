# Error Handler Migration Audit

## Status Summary

**Total API Routes Found:** 154 route files  
**Routes Using Ad Hoc Error Responses:** ~12-15 identified  
**Routes Using ErrorHandler:** Several with partial adoption  
**Priority Targets:** quote, currencies, graphql, logs, transactions, bridge

---

## Ad Hoc Error Response Patterns Found

### Pattern 1: Direct NextResponse.json with error object
```typescript
// INCONSISTENT
return NextResponse.json({ error: 'Bridge quote unavailable' }, { status: 502 });
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

// INCONSISTENT (different shape)
return NextResponse.json({ valid: false, error: `Unsupported currency: ${validateCode}` });
```

**Files with this pattern:**
- `src/app/api/offramp/quote/route.ts` (2 instances)
- `src/app/api/offramp/currencies/route.ts` (2 instances)
- `src/app/api/offramp/status/[orderId]/route.ts` (1 instance)
- `src/app/api/cron/soroban-event-sync.ts` (2 instances)
- `src/app/api/transactions/on-chain-status.ts` (3 instances)

### Pattern 2: No error handling (implicit errors)
Several routes lack try/catch or proper error handling, relying on Next.js implicit error conversion.

---

## Existing Error Handler Support

### Routes Already Using ErrorHandler:
- `src/app/api/offramp/quote/route.ts` (uses ErrorHandler for some cases)
- `src/app/api/logs/search/route.ts` (uses ErrorHandler)
- `src/app/api/graphql/route.ts` (custom formatError, not using ErrorHandler)

### Partially Migrated:
- `/offramp/quote` - Uses ErrorHandler for validation but has ad hoc error responses for external service failures
- `/offramp/currencies` - Mix of enrichment validation with ad hoc responses

---

## Standard Error Response Schema

### Current StandardErrorResponse Interface:
```typescript
interface StandardErrorResponse {
  error: string;           // Machine-readable error code (e.g., 'validation_error', 'not_found')
  message?: string;        // Human-readable description
  details?: unknown;       // Additional context (dev only)
}
```

### Supported ErrorTypes:
- `validation_error` → 400
- `not_found` → 404
- `unauthorized` → 401
- `forbidden` → 403
- `conflict` → 409
- `rate_limit_exceeded` → 429
- `server_error` → 500
- `external_service_error` → 502

---

## Priority Routes for Migration

### Phase 1 (High Priority):
1. **Quote Route** (`/api/offramp/quote/route.ts`)
   - Currently uses ErrorHandler for some validations
   - Has 2 ad hoc responses for bridge/FX rate unavailability (should be external_service_error)
   
2. **Currencies Route** (`/api/offramp/currencies/route.ts`)
   - Inconsistent error shape with `{ valid: false, error }` 
   - Should standardize to ErrorHandler responses

3. **Transactions Route** (`/api/transactions/on-chain-status.ts`)
   - 3 ad hoc error responses for auth/validation/not_found
   - Should use ErrorHandler factory methods

4. **GraphQL Route** (`/api/graphql/route.ts`)
   - Has custom formatError aligned with REST but not using ErrorHandler
   - Should be unified with ErrorHandler

5. **Logs Route** (`/api/logs/search/route.ts`)
   - Partially uses ErrorHandler
   - May have ad hoc responses to migrate

### Phase 2 (Secondary):
- Bridge routes (`/api/offramp/bridge/*`)
- Cron routes (`/api/cron/*`)
- Other offramp routes

---

## Issues with Current Inconsistency

1. **Client Confusion**: Different response shapes across endpoints
   - Some return `{ error: string }`
   - Some return `{ error, message }` 
   - Some return `{ valid: false, error }`

2. **Missing Context**: No standardized error details in dev environments

3. **Status Code Mismatches**: External service errors sometimes return incorrect status codes

4. **Testing Burden**: Tests must handle multiple error response shapes

5. **Documentation Gap**: No single source of truth for error response format in OpenAPI spec

---

## Migration Requirements

### For Each Route:
1. Replace `NextResponse.json({ error: ... }, { status })` with `ErrorHandler` factories
2. Preserve error semantics (e.g., 404 → `ErrorHandler.notFound()`)
3. Add ApiError where appropriate for specific error types
4. Update test assertions to match StandardErrorResponse shape
5. Verify status codes match ErrorType mappings

### For Tests:
1. Update test fixtures to expect `{ error, message?, details? }` shape
2. Add integration tests verifying error consistency across routes
3. Create snapshot tests for error responses

### For Documentation:
1. Update OpenAPI spec to show StandardErrorResponse as components/schemas
2. Document error type codes and their HTTP status mappings
3. Create internal guide for route developers on when to use which ErrorHandler method

---

## Next Steps

1. ✅ **Audit Complete** - This document
2. ⏳ **Create Documentation** - Standard error schema documentation
3. ⏳ **Migrate Priority Routes** - quote → currencies → transactions → graphql → logs
4. ⏳ **Update Tests** - Align test assertions and create regression tests
5. ⏳ **Verify Suite** - Run full test suite
6. ⏳ **Developer Guide** - Create migration guide for future routes

