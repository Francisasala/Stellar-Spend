import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/two-fa', () => ({
  TwoFAService: {
    generateTOTPSecret: vi.fn(() => 'SECRET123'),
    generateBackupCodes: vi.fn(() => ['aaa111', 'bbb222']),
    generateTOTPURI: vi.fn(() => 'otpauth://totp/Stellar-Spend:user-1?secret=SECRET123'),
  },
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/2fa/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/2fa/setup', () => {
  it('rejects a missing userId', async () => {
    const res = await POST(makeRequest({ method: 'totp' }));
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported method', async () => {
    const res = await POST(makeRequest({ userId: 'user-1', method: 'carrier-pigeon' }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not valid',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns a TOTP secret and URI for a valid totp setup request', async () => {
    const res = await POST(makeRequest({ userId: 'user-1', method: 'totp' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method).toBe('totp');
    expect(body.secret).toBe('SECRET123');
  });

  it('accepts a valid sms setup request', async () => {
    const res = await POST(makeRequest({ userId: 'user-1', method: 'sms' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method).toBe('sms');
  });
});
