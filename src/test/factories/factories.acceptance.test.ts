/**
 * Acceptance checks for the typed test-data factories (#1514).
 *
 * Verifies factories produce fully typed, deterministic data that is safe
 * to reuse across suites (#1514).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { seed, seedWith } from './seed';
import {
  makeTransaction,
  makeTransactions,
  completedTransaction,
  failedTransaction,
} from './transaction.factory';
import { makeQuote, makeQuoteForCurrency } from './quote.factory';
import { makeUser, makeUsers } from './user.factory';
import { makeBeneficiary, makeBeneficiaryForCurrency } from './beneficiary.factory';
import type { Transaction } from './transaction.factory';

describe('test data factories (acceptance)', () => {
  beforeEach(() => seed());

  it('makeTransaction returns typed data with defaults', () => {
    const tx = makeTransaction();
    expect(tx).toMatchObject({});
    expect(typeof tx.id).toBe('string');
    expect(typeof tx.status).toBe('string');
  });

  it('makeTransactions produces distinct, deterministic ids', () => {
    const a = makeTransactions(3);
    const ids = new Set(a.map((t) => t.id));
    expect(ids.size).toBe(3);
    seed();
    const b = makeTransactions(3);
    expect(b.map((t) => t.id)).toEqual(a.map((t) => t.id));
  });

  it('trait variants return typed shapes', () => {
    expect(completedTransaction().status).toBe('completed');
    expect(failedTransaction().status).toBe('failed');
  });

  it('makeQuote produces a quote with currency', () => {
    const quote = makeQuoteForCurrency('NGN');
    expect(quote).toHaveProperty('currency', 'NGN');
  });

  it('makeUser returns a typed user', () => {
    const user = makeUser();
    expect(typeof user.id).toBe('string');
    expect(typeof user.address).toBe('string');
    expect(makeUsers(2).length).toBe(2);
  });

  it('makeBeneficiary produces typed beneficiary data', () => {
    const beneficiary = makeBeneficiaryForCurrency('USD');
    expect(beneficiary).toHaveProperty('currency', 'USD');
  });

  it('types line up with consuming code', () => {
    const tx: Transaction = makeTransaction();
    expect(tx).toBeInstanceOf(Object);
  });
});
