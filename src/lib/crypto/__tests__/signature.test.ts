import { describe, it, expect } from 'vitest';
import { sign, verify, safeCompare } from '../signature';

describe('crypto/signature', () => {
  const secret = 'test-secret-please-change';
  const payload = JSON.stringify({ event: 'payout.completed', id: 'po_123' });

  describe('sign', () => {
    it('produces a deterministic hex HMAC-SHA256', () => {
      const a = sign(payload, secret);
      const b = sign(payload, secret);
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('supports sha512 and base64', () => {
      const s = sign(payload, secret, 'sha512', 'base64');
      expect(s).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('throws when secret is missing', () => {
      expect(() => sign(payload, '')).toThrow();
    });

    it('accepts Buffer payloads', () => {
      const s1 = sign(Buffer.from(payload, 'utf8'), secret);
      const s2 = sign(payload, secret);
      expect(s1).toBe(s2);
    });
  });

  describe('verify', () => {
    it('returns true for a valid signature', () => {
      const sig = sign(payload, secret);
      expect(verify(payload, sig, secret)).toBe(true);
    });

    it('returns false for a tampered payload', () => {
      const sig = sign(payload, secret);
      const tampered = payload.replace('po_123', 'po_999');
      expect(verify(tampered, sig, secret)).toBe(false);
    });

    it('returns false for a tampered signature', () => {
      const sig = sign(payload, secret);
      const tampered = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
      expect(verify(payload, tampered, secret)).toBe(false);
    });

    it('returns false for the wrong secret', () => {
      const sig = sign(payload, secret);
      expect(verify(payload, sig, 'wrong-secret')).toBe(false);
    });

    it('returns false for empty signature or secret', () => {
      expect(verify(payload, '', secret)).toBe(false);
      expect(verify(payload, 'abc', '')).toBe(false);
    });

    it('returns false on length mismatch without throwing', () => {
      expect(verify(payload, 'short', secret)).toBe(false);
    });

    it('is consistent across sha512/base64', () => {
      const sig = sign(payload, secret, 'sha512', 'base64');
      expect(verify(payload, sig, secret, 'sha512', 'base64')).toBe(true);
      // Wrong params should fail
      expect(verify(payload, sig, secret, 'sha256', 'base64')).toBe(false);
      expect(verify(payload, sig, secret, 'sha512', 'hex')).toBe(false);
    });
  });

  describe('safeCompare', () => {
    it('returns true for identical strings', () => {
      expect(safeCompare('abc', 'abc')).toBe(true);
    });
    it('returns false for different strings', () => {
      expect(safeCompare('abc', 'abd')).toBe(false);
    });
    it('returns false on length mismatch without throwing', () => {
      expect(safeCompare('abc', 'abcd')).toBe(false);
    });
  });
});
