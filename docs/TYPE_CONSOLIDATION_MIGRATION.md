# Type Consolidation Migration Guide (Issue #968)

## Overview

This document provides guidance on migrating duplicate type definitions to the consolidated types in `packages/shared/src/types/api-responses.ts`.

## Motivation

Previously, API response types were defined in multiple places:
- `src/lib/offramp/types/index.ts`
- `src/lib/onramp/types/index.ts`
- `src/app/api/*/route.ts` files
- Various service files

This created:
- **Maintenance burden**: Changes must be made in multiple locations
- **Inconsistency**: Types could diverge between implementations
- **Poor DX**: Developers must find the correct type definition
- **Refactoring risk**: Harder to safely rename or restructure

## Solution

All API response types are now consolidated in `packages/shared/src/types/api-responses.ts`, which is:
- **Exported from** `packages/shared`
- **Used by** both frontend and backend code
- **Single source of truth** for all request/response shapes
- **Easily discoverable** in one place

## Migration Steps

### Step 1: Update Imports

Replace imports of types from scattered locations with imports from `packages/shared`:

**Before:**
```typescript
import { QuoteRequest, QuoteResponse } from '@/lib/offramp/types';
import { BeneficiaryInfo } from '@/lib/offramp/adapters/paycrest-adapter';
```

**After:**
```typescript
import {
  QuoteRequest,
  QuoteResponse,
  BeneficiaryInfo,
} from '@stellar-spend/shared';
```

### Step 2: Remove Duplicate Definitions

Once imports are updated, remove duplicate type definitions from local files:

```bash
# Remove types from offramp
rm src/lib/offramp/types/index.ts

# Remove duplicate definitions from service files
# (Keep only re-exports if still used internally)
```

### Step 3: Update Local Type Files

For service files that defined their own types:

**Before (src/lib/services/quote.service.ts):**
```typescript
export interface QuoteRequest {
  sourceToken: TokenInfo;
  destinationToken: TokenInfo;
  amount: string;
  isFiatInput: boolean;
  currency: string;
}

export interface QuoteResponse {
  sourceAmount: string;
  destinationAmount: string;
  bridgeFee: string;
  payoutFee: string;
  rate: number;
  estimatedTime: number;
  validUntil: Date;
}

export class QuoteService {
  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    // ...
  }
}
```

**After:**
```typescript
import { QuoteRequest, QuoteResponse } from '@stellar-spend/shared';

export class QuoteService {
  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    // ...
  }
}
```

### Step 4: Update Route Handlers

For API route handlers, import consolidated types:

**Before (src/app/api/offramp/quote/route.ts):**
```typescript
import { QuoteRequest, QuoteResponse } from '@/lib/offramp/types';

export async function POST(request: NextRequest) {
  const body: QuoteRequest = await request.json();
  // ...
  return NextResponse.json<QuoteResponse>({
    quoteId: '...',
    sourceAmount: '...',
    // ...
  });
}
```

**After:**
```typescript
import { QuoteRequest, QuoteResponse } from '@stellar-spend/shared';

export async function POST(request: NextRequest) {
  const body: QuoteRequest = await request.json();
  // ...
  return NextResponse.json<QuoteResponse>({
    quoteId: '...',
    sourceAmount: '...',
    // ...
  });
}
```

## Consolidated Types Reference

### Core API Types
- `ApiResponse<T>` - Generic API response wrapper
- `ApiError` - Error response format
- `PaginatedResponse<T>` - Paginated list responses
- `ErrorResponse` - Standardized error responses

### Quote/Exchange Types
- `QuoteRequest` - Request for price quotes
- `QuoteResponse` - Quote with fees and rates
- `ExchangeRate` - Exchange rate information

### Trade/Payout Types
- `ExecuteRequest` - Trade/payout execution request
- `ExecuteResponse` - Execution confirmation
- `TradeStatus` - Trade status tracking
- `BeneficiaryInfo` - Bank account information

### Transaction Types
- `OnChainTransaction` - Blockchain transaction
- `TransactionStatus` - Transaction state enum

### Bridge Types
- `BridgeTransferRequest` - Bridge transfer initiation
- `BridgeTransferResponse` - Bridge transfer confirmation
- `BridgeStatus` - Bridge operation status enum

### Payout Types
- `PayoutOrderRequest` - Payout order creation
- `PayoutOrderResponse` - Payout order confirmation
- `PayoutStatus` - Payout status enum

### Supporting Types
- `TokenInfo` - Crypto token information
- `CurrencyInfo` - Fiat currency information
- `WalletInfo` - Wallet/account information
- `HealthCheckResponse` - Service health status

## Key Improvements

### Type Safety
```typescript
// Before: Types could be imported from wrong locations
const quote: QuoteResponse = data; // Might be using old definition

// After: Single source of truth
import { QuoteResponse } from '@stellar-spend/shared';
const quote: QuoteResponse = data; // Always correct definition
```

### Consistency
All API routes now use the same type definitions, ensuring:
- Consistent field names and types
- Aligned serialization (dates as ISO 8601 strings)
- Matching error response structures

### Discoverability
```typescript
// Easy to find all available types
import * as SharedTypes from '@stellar-spend/shared';
// Browse SharedTypes.* for all API types
```

## Common Migration Patterns

### Pattern 1: Simple Type Re-export

**Before:**
```typescript
// src/lib/services/quote.service.ts
export interface QuoteResponse {
  quoteId: string;
  // ...
}
```

**After:**
```typescript
// src/lib/services/quote.service.ts
export { QuoteResponse } from '@stellar-spend/shared';
```

### Pattern 2: Service that Returns Shared Types

**Before:**
```typescript
import { QuoteResponse } from '@/lib/offramp/types';

export class QuoteAggregator {
  async aggregate(): Promise<QuoteResponse[]> {
    // ...
  }
}
```

**After:**
```typescript
import { QuoteResponse } from '@stellar-spend/shared';

export class QuoteAggregator {
  async aggregate(): Promise<QuoteResponse[]> {
    // ...
  }
}
```

### Pattern 3: Request/Response in Route Handler

**Before:**
```typescript
import type { QuoteRequest, QuoteResponse } from '@/lib/offramp/types';

interface QuoteQuery {
  amount: string;
  sourceToken: string;
  destinationToken: string;
}

export async function POST(request: NextRequest) {
  const query: QuoteQuery = await request.json();
  const quoteRequest: QuoteRequest = {
    // transform query to QuoteRequest
  };
  const response: QuoteResponse = await service.getQuote(quoteRequest);
  return NextResponse.json(response);
}
```

**After:**
```typescript
import { QuoteRequest, QuoteResponse } from '@stellar-spend/shared';

export async function POST(request: NextRequest) {
  const quoteRequest: QuoteRequest = await request.json();
  const response: QuoteResponse = await service.getQuote(quoteRequest);
  return NextResponse.json(response);
}
```

## Validation Checklist

After migrating types, verify:

- [ ] All `import` statements updated to use `@stellar-spend/shared`
- [ ] Old type files removed or deprecated
- [ ] TypeScript compilation passes (`npm run build`)
- [ ] No unused imports in modified files
- [ ] API response shapes match type definitions
- [ ] Serialization format matches (dates as ISO strings)
- [ ] Tests updated with new import paths
- [ ] No circular dependencies introduced

## Extending Consolidated Types

When adding new API endpoints:

1. **Define request/response types** in `packages/shared/src/types/api-responses.ts`
2. **Export from shared package** via `packages/shared/src/index.ts`
3. **Import and use** in service layer and API routes
4. **Never redefine types** in service or route files

Example:
```typescript
// Add to packages/shared/src/types/api-responses.ts
export interface NewEndpointRequest {
  field1: string;
  field2: number;
}

export interface NewEndpointResponse {
  result: string;
  timestamp: string;
}

// Add to packages/shared/src/index.ts
export type { NewEndpointRequest, NewEndpointResponse } from './types/api-responses';

// Use in src/app/api/new-endpoint/route.ts
import { NewEndpointRequest, NewEndpointResponse } from '@stellar-spend/shared';
```

## Troubleshooting

### Issue: Circular Dependency

If you encounter circular dependencies after consolidation:

1. Check if `packages/shared` imports from `src/lib`
2. Move implementation details out of type definitions
3. Use TypeScript utility types to compose complex types

### Issue: Runtime Serialization Mismatch

Ensure dates in responses are serialized as ISO 8601 strings:

```typescript
// Wrong - Date objects don't serialize properly in JSON
const response: QuoteResponse = {
  validUntil: new Date(), // ❌ Will be "[object Date]"
};

// Correct - ISO string
const response: QuoteResponse = {
  validUntil: new Date().toISOString(), // ✅ "2024-01-15T10:30:00Z"
};
```

### Issue: Type Definition Divergence

If you find duplicate definitions that differ:

1. Compare all versions to understand intended behavior
2. Consolidate into single definition that satisfies all use cases
3. Update all call sites to match consolidated definition
4. Run tests to ensure behavior unchanged

## Related Issues

- Issue #863: Original attempt at type consolidation
- Issue #968: This consolidation effort

## See Also

- `packages/shared/src/types/api-responses.ts` - Consolidated types
- `packages/shared/src/index.ts` - Type exports
- TypeScript Handbook: [Interfaces](https://www.typescriptlang.org/docs/handbook/interfaces.html)
