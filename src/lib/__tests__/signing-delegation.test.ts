import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('signing modules delegate to shared primitive (#1205)', () => {
  it('request-signing.ts imports from @/lib/crypto/signature', () => {
    const src = read('src/lib/request-signing.ts');
    expect(src).toMatch(/from\s+['"]@\/lib\/crypto\/signature['"]/);
    expect(src).not.toMatch(/createHmac/);
  });

  it('webhook/security.ts imports from @/lib/crypto/signature', () => {
    const src = read('src/lib/webhook/security.ts');
    expect(src).toMatch(/from\s+['"]@\/lib\/crypto\/signature['"]/);
    expect(src).not.toMatch(/crypto\.subtle\.sign/);
  });
});

describe('webhook signature verification rejects tampered payloads', () => {
  it('rejects when the payload changes', async () => {
    const mod = await import('../webhook/security');
    const secret = 'test-secret';
    const original = JSON.stringify({ event: 'payout.completed', id: 'po_1' });
    const sig = await mod.generateOutgoingSignature(original, secret);

    const tampered = JSON.stringify({ event: 'payout.completed', id: 'po_2' });
    const result = await mod.verifyWebhookSignature(tampered, sig, secret);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invalid signature');
  });

  it('accepts an untampered payload', async () => {
    const mod = await import('../webhook/security');
    const secret = 'test-secret';
    const payload = JSON.stringify({ event: 'payout.completed', id: 'po_1' });
    const sig = await mod.generateOutgoingSignature(payload, secret);
    const result = await mod.verifyWebhookSignature(payload, sig, secret);
    expect(result.valid).toBe(true);
  });
});
