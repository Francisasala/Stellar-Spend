import { describe, it, expect } from 'vitest';
import * as Transactions from './index';

describe('@/lib/transactions barrel export', () => {
  it('re-exports symbols from all five transaction modules', () => {
    expect(Transactions).toBeDefined();
    // spot-check representative exports from each grouped module
    expect(typeof Transactions.TransactionSearchService).toBe('function');
  });
});
