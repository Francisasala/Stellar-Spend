import { describe, it, expect, vi } from 'vitest';
import * as crypto from 'crypto';

// Test for Issue #1293: Remove duplicate webhook verification
// Acceptance criteria: single verifier; unit tests for invalid signatures.

vi.mock('@/lib/db/client', () => ({ pool: { query: vi.fn() } }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as webhookVerify from '@/lib/webhookVerify';
import * as webhookSecurity from '@/lib/webhook/security';

const SECRET = 'test-webhook-secret';
const BODY = JSON.stringify({ event: 'transaction.completed', id: 'tx_1' });

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('Single webhook signature verifier - Issue #1293', () => {
  it('re-exports the same verifier functions from webhook/security', () => {
    expect(webhookSecurity.verifyWebhookSignature).toBe(webhookVerify.verifyWebhookSignature);
    expect(webhookSecurity.verifyProviderSignature).toBe(webhookVerify.verifyProviderSignature);
    expect(webhookSecurity.generateOutgoingSignature).toBe(webhookVerify.generateOutgoingSignature);
  });

  it('accepts a valid HMAC-SHA256 signature', async () => {
    const result = await webhookVerify.verifyHmacSignature(BODY, sign(BODY, SECRET), SECRET);
    expect(result.valid).toBe(true);
  });

  it('rejects a missing signature', async () => {
    const result = await webhookVerify.verifyHmacSignature(BODY, null, SECRET);
    expect(result).toEqual({ valid: false, reason: 'Missing signature' });
  });

  it('rejects a signature computed with a different secret', async () => {
    const result = await webhookVerify.verifyHmacSignature(
      BODY,
      sign(BODY, 'wrong-secret'),
      SECRET,
    );
    expect(result).toEqual({ valid: false, reason: 'Invalid signature' });
  });

  it('rejects a signature over a tampered body', async () => {
    const tampered = BODY.replace('tx_1', 'tx_2');
    const result = await webhookVerify.verifyHmacSignature(tampered, sign(BODY, SECRET), SECRET);
    expect(result.valid).toBe(false);
  });

  it('rejects a truncated signature of the wrong length', async () => {
    const truncated = sign(BODY, SECRET).slice(0, 16);
    const result = await webhookVerify.verifyHmacSignature(BODY, truncated, SECRET);
    expect(result).toEqual({ valid: false, reason: 'Invalid signature' });
  });

  it('fails closed when the secret is not configured', async () => {
    const result = await webhookVerify.verifyHmacSignature(BODY, sign(BODY, ''), '');
    expect(result).toEqual({ valid: false, reason: 'Webhook secret not configured' });
  });

  it('generates signatures that the verifier accepts', async () => {
    const signature = await webhookVerify.generateOutgoingSignature(BODY, SECRET);
    expect(signature).toBe(sign(BODY, SECRET));
    const result = await webhookVerify.verifyHmacSignature(BODY, signature, SECRET);
    expect(result.valid).toBe(true);
  });
});
