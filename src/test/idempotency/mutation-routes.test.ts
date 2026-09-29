import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Manual reconciliation mutates state and must be idempotent.
 * Other offramp reconciliation routes are pure (compute report/alerts)
 * and intentionally do not require idempotency.
 */
const MUTATION_ROUTES = [
  'src/app/api/offramp/reconciliation/manual/route.ts',
  'src/app/api/offramp/bridge/submit-soroban/route.ts',
  'src/app/api/offramp/execute-payout/route.ts',
  'src/app/api/onramp/order/route.ts',
  'src/app/api/offramp/refund/route.ts',
  'src/app/api/offramp/reverse/route.ts',
];

describe('money-mutating endpoints use withIdempotency (#1204)', () => {
  for (const rel of MUTATION_ROUTES) {
    it(`${rel} imports withIdempotency`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8');
      expect(src).toMatch(/from\s+['"]@\/lib\/idempotency['"]/);
      expect(src).toMatch(/withIdempotency/);
    });

    it(`${rel} wraps its POST handler`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8');
      const postIdx = src.search(/export\s+async\s+function\s+POST/);
      expect(postIdx).toBeGreaterThanOrEqual(0);
      expect(src.slice(postIdx)).toMatch(/withIdempotency\s*\(\s*req/);
    });
  }
});
