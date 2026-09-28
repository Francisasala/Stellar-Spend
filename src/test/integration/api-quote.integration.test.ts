import { describe, it, expect } from 'vitest';
import { createMocks } from 'node-mocks-http';
import { POST as quoteHandler } from '@/app/api/offramp/quote/route';

describe('POST /api/offramp/quote - Integration Tests', () => {
  describe('Valid requests', () => {
    it('should return quote for valid USDC amount', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: '100',
          currency: 'NGN',
          feeMethod: 'USDC',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.destinationAmount).toBeDefined();
      expect(data.rate).toBeGreaterThan(0);
      expect(data.currency).toBe('NGN');
    });

    it('should return quote for native fee method', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: '100',
          currency: 'KES',
          feeMethod: 'XLM',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.bridgeFee).toBe('0');
    });

    it('should handle large amounts', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: '10000',
          currency: 'NGN',
          feeMethod: 'USDC',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.destinationAmount).toBeDefined();
    });

    it('should handle small amounts', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: '0.01',
          currency: 'NGN',
          feeMethod: 'USDC',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('Invalid requests', () => {
    it('should reject negative amount', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: '-100',
          currency: 'NGN',
          feeMethod: 'USDC',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toBeDefined();
    });

    it('should reject zero amount', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: '0',
          currency: 'NGN',
          feeMethod: 'USDC',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(400);
    });

    it('should reject missing currency', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: '100',
          feeMethod: 'USDC',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(400);
    });

    it('should reject unsupported currency', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: '100',
          currency: 'INVALID',
          feeMethod: 'USDC',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(400);
    });

    it('should reject invalid fee method', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: '100',
          currency: 'NGN',
          feeMethod: 'INVALID',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(400);
    });

    it('should reject non-numeric amount', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: 'abc',
          currency: 'NGN',
          feeMethod: 'USDC',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(400);
    });
  });

  describe('Edge cases', () => {
    it('should handle decimal amounts', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: '99.99',
          currency: 'NGN',
          feeMethod: 'USDC',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should handle very large decimal places', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          amount: '100.123456789',
          currency: 'NGN',
          feeMethod: 'USDC',
        },
      });

      await quoteHandler(req);

      expect(res._getStatusCode()).toBe(200);
    });
  });
});
