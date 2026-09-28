import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  TransactionStatus,
  Transaction,
  Quote,
  QuoteFees,
} from './transaction';

describe('Transaction types', () => {
  it('TransactionStatus includes all valid statuses', () => {
    const statuses: TransactionStatus[] = [
      'pending',
      'signing',
      'submitted',
      'bridging',
      'paying_out',
      'complete',
      'failed',
    ];
    expect(statuses).toHaveLength(7);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('complete');
    expect(statuses).toContain('failed');
  });

  it('Transaction has all required fields', () => {
    const tx: Transaction = {
      id: 'tx_001',
      amount: '100.00',
      currency: 'NGN',
      status: 'pending',
      timestamp: '2025-01-15T10:30:00Z',
      sourcePublicKey: 'GBXXXX',
      destinationAccount: '1234567890',
    };
    expect(tx.id).toBe('tx_001');
    expect(tx.status).toBe('pending');
    expectTypeOf(tx.bridgeTxHash).toMatchTypeOf<string | undefined>();
    expectTypeOf(tx.payoutId).toMatchTypeOf<string | undefined>();
  });

  it('Transaction accepts optional fields', () => {
    const tx: Transaction = {
      id: 'tx_002',
      amount: '50.00',
      currency: 'KES',
      status: 'complete',
      timestamp: '2025-01-15T10:30:00Z',
      sourcePublicKey: 'GBXXXX',
      destinationAccount: '1234567890',
      bridgeTxHash: '0xabc123',
      payoutId: 'pay_001',
    };
    expect(tx.bridgeTxHash).toBe('0xabc123');
    expect(tx.payoutId).toBe('pay_001');
  });

  it('Quote has all required fields', () => {
    const quote: Quote = {
      exchangeRate: 1598,
      sourceAmount: '10.00',
      destinationAmount: '15980',
      fees: {
        bridgeFee: '0.50',
        networkFee: '0.00001',
        payoutFee: '1.00',
        total: '1.50',
      },
      expiresAt: '2025-01-15T10:35:00Z',
    };
    expect(quote.exchangeRate).toBe(1598);
    expect(quote.fees.total).toBe('1.50');
  });

  it('QuoteFees has all required fields', () => {
    const fees: QuoteFees = {
      bridgeFee: '0.50',
      networkFee: '0.00001',
      payoutFee: '1.00',
      total: '1.50',
    };
    expect(Object.keys(fees)).toHaveLength(4);
  });
});
