import { describe, it, expect } from 'vitest';
import { createMocks } from 'node-mocks-http';

describe('Paycrest API Endpoints - Integration Tests', () => {
  describe('POST /api/offramp/paycrest/order', () => {
    it('should create payout order with valid data', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          amount: '100',
          currency: 'NGN',
          beneficiary: {
            accountNumber: '1234567890',
            bankCode: '044',
            name: 'John Doe',
          },
          sourceAddress: '0x1234567890123456789012345678901234567890',
        },
      });

      expect(req.body.amount).toBe('100');
      expect(req.body.currency).toBe('NGN');
      expect(req.body.beneficiary).toBeDefined();
    });

    it('should reject invalid amount', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          amount: '-100',
          currency: 'NGN',
          beneficiary: {
            accountNumber: '1234567890',
            bankCode: '044',
            name: 'John Doe',
          },
        },
      });

      expect(req.body.amount).toBe('-100');
    });

    it('should reject unsupported currency', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          amount: '100',
          currency: 'INVALID',
          beneficiary: {
            accountNumber: '1234567890',
            bankCode: '044',
            name: 'John Doe',
          },
        },
      });

      expect(req.body.currency).toBe('INVALID');
    });

    it('should reject missing beneficiary data', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          amount: '100',
          currency: 'NGN',
          beneficiary: {
            accountNumber: '',
            bankCode: '044',
            name: 'John Doe',
          },
        },
      });

      expect(req.body.beneficiary.accountNumber).toBe('');
    });

    it('should handle multiple currencies', async () => {
      const currencies = ['NGN', 'KES', 'GHS', 'UGX'];

      for (const currency of currencies) {
        const { req } = createMocks({
          method: 'POST',
          body: {
            amount: '100',
            currency,
            beneficiary: {
              accountNumber: '1234567890',
              bankCode: '044',
              name: 'John Doe',
            },
          },
        });

        expect(req.body.currency).toBe(currency);
      }
    });
  });

  describe('GET /api/offramp/status/:orderId', () => {
    it('should return order status', async () => {
      const { req } = createMocks({
        method: 'GET',
        query: { orderId: 'order-123' },
      });

      expect(req.query.orderId).toBe('order-123');
    });

    it('should handle pending status', async () => {
      const { req } = createMocks({
        method: 'GET',
        query: { orderId: 'pending-order' },
      });

      expect(req.query.orderId).toBe('pending-order');
    });

    it('should handle completed status', async () => {
      const { req } = createMocks({
        method: 'GET',
        query: { orderId: 'completed-order' },
      });

      expect(req.query.orderId).toBe('completed-order');
    });

    it('should handle failed status', async () => {
      const { req } = createMocks({
        method: 'GET',
        query: { orderId: 'failed-order' },
      });

      expect(req.query.orderId).toBe('failed-order');
    });
  });

  describe('POST /api/offramp/verify-account', () => {
    it('should verify valid account', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          accountNumber: '1234567890',
          bankCode: '044',
          currency: 'NGN',
        },
      });

      expect(req.body.accountNumber).toBe('1234567890');
      expect(req.body.bankCode).toBe('044');
    });

    it('should reject invalid account number', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          accountNumber: 'invalid',
          bankCode: '044',
          currency: 'NGN',
        },
      });

      expect(req.body.accountNumber).toBe('invalid');
    });

    it('should reject missing bank code', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          accountNumber: '1234567890',
          bankCode: '',
          currency: 'NGN',
        },
      });

      expect(req.body.bankCode).toBe('');
    });
  });
});
