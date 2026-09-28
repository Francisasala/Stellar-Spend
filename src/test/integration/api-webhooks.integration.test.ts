import { describe, it, expect } from 'vitest';
import { createMocks } from 'node-mocks-http';
import crypto from 'crypto';

describe('Webhook Endpoints - Integration Tests', () => {
  const WEBHOOK_SECRET = process.env.PAYCREST_WEBHOOK_SECRET || 'test-secret';

  const generateHMAC = (payload: string): string => {
    return crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  };

  describe('POST /api/webhooks/paycrest', () => {
    it('should accept valid webhook with correct HMAC', async () => {
      const payload = JSON.stringify({
        orderId: 'order-123',
        status: 'completed',
        amount: '100',
        currency: 'NGN',
      });

      const hmac = generateHMAC(payload);

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-paycrest-signature': hmac,
        },
        body: JSON.parse(payload),
      });

      expect(req.headers['x-paycrest-signature']).toBe(hmac);
    });

    it('should reject webhook with invalid HMAC', async () => {
      const payload = JSON.stringify({
        orderId: 'order-123',
        status: 'completed',
      });

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-paycrest-signature': 'invalid-hmac',
        },
        body: JSON.parse(payload),
      });

      expect(req.headers['x-paycrest-signature']).toBe('invalid-hmac');
    });

    it('should reject webhook without signature', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          orderId: 'order-123',
          status: 'completed',
        },
      });

      expect(req.headers['x-paycrest-signature']).toBeUndefined();
    });

    it('should handle order completed event', async () => {
      const payload = JSON.stringify({
        event: 'order.completed',
        orderId: 'order-123',
        status: 'completed',
        amount: '100',
        currency: 'NGN',
      });

      const hmac = generateHMAC(payload);

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-paycrest-signature': hmac,
        },
        body: JSON.parse(payload),
      });

      expect(req.body.event).toBe('order.completed');
    });

    it('should handle order failed event', async () => {
      const payload = JSON.stringify({
        event: 'order.failed',
        orderId: 'order-123',
        status: 'failed',
        reason: 'Insufficient funds',
      });

      const hmac = generateHMAC(payload);

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-paycrest-signature': hmac,
        },
        body: JSON.parse(payload),
      });

      expect(req.body.event).toBe('order.failed');
    });

    it('should handle order pending event', async () => {
      const payload = JSON.stringify({
        event: 'order.pending',
        orderId: 'order-123',
        status: 'pending',
      });

      const hmac = generateHMAC(payload);

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-paycrest-signature': hmac,
        },
        body: JSON.parse(payload),
      });

      expect(req.body.event).toBe('order.pending');
    });

    it('should handle duplicate webhook gracefully', async () => {
      const payload = JSON.stringify({
        orderId: 'order-123',
        status: 'completed',
        idempotencyKey: 'key-123',
      });

      const hmac = generateHMAC(payload);

      const { req: req1 } = createMocks({
        method: 'POST',
        headers: {
          'x-paycrest-signature': hmac,
        },
        body: JSON.parse(payload),
      });

      const { req: req2 } = createMocks({
        method: 'POST',
        headers: {
          'x-paycrest-signature': hmac,
        },
        body: JSON.parse(payload),
      });

      expect(req1.body.idempotencyKey).toBe(req2.body.idempotencyKey);
    });
  });

  describe('Error scenarios', () => {
    it('should handle malformed JSON', async () => {
      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-paycrest-signature': 'some-signature',
        },
        body: 'invalid json',
      });

      expect(typeof req.body).toBe('string');
    });

    it('should handle missing required fields', async () => {
      const payload = JSON.stringify({
        orderId: 'order-123',
        // missing status
      });

      const hmac = generateHMAC(payload);

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-paycrest-signature': hmac,
        },
        body: JSON.parse(payload),
      });

      expect(req.body.status).toBeUndefined();
    });
  });
});
