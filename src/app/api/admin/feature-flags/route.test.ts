import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/app/api/api-keys/_utils', () => ({
  requireApiKeyAdmin: vi.fn(() => null),
}));

const setFlagOverridesMock = vi.fn();
vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: vi.fn(),
  setFlagOverrides: (...args: unknown[]) => setFlagOverridesMock(...args),
  clearFlagOverrides: vi.fn(),
}));

import { PUT } from './route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/feature-flags', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/admin/feature-flags', () => {
  beforeEach(() => {
    setFlagOverridesMock.mockReset();
    setFlagOverridesMock.mockResolvedValue(undefined);
  });

  it('applies a valid partial override', async () => {
    const res = await PUT(makeRequest({ corridors: { nigeriaNgn: true } }));

    expect(res.status).toBe(200);
    expect(setFlagOverridesMock).toHaveBeenCalledWith({ corridors: { nigeriaNgn: true } });
  });

  it('rejects an unknown top-level key', async () => {
    const res = await PUT(makeRequest({ notAKnownSection: true }));

    expect(res.status).toBe(400);
    expect(setFlagOverridesMock).not.toHaveBeenCalled();
  });

  it('rejects a wrong-typed nested field', async () => {
    const res = await PUT(
      makeRequest({ corridors: { nigeriaNgn: { enabled: true, percentage: 'not-a-number' } } }),
    );

    expect(res.status).toBe(400);
    expect(setFlagOverridesMock).not.toHaveBeenCalled();
  });

  it('rejects a rollout percentage outside 0-1', async () => {
    const res = await PUT(
      makeRequest({ experiments: { newQuoteEngine: { enabled: true, percentage: 5 } } }),
    );

    expect(res.status).toBe(400);
    expect(setFlagOverridesMock).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/admin/feature-flags', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{not valid',
    });

    const res = await PUT(req);

    expect(res.status).toBe(400);
    expect(setFlagOverridesMock).not.toHaveBeenCalled();
  });

  it('does not fill in defaults for fields omitted from a partial override', async () => {
    // Only nigeriaNgn is provided — the other corridors keys must stay
    // entirely absent from what's passed to setFlagOverrides, since the
    // store deep-merges overrides over the existing flags.
    await PUT(makeRequest({ corridors: { nigeriaNgn: false } }));

    const [applied] = setFlagOverridesMock.mock.calls[0];
    expect(Object.keys(applied.corridors)).toEqual(['nigeriaNgn']);
  });
});
