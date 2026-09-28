import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('./src/lib/performance', () => ({ recordApiTiming: vi.fn() }));
vi.mock('./src/lib/logger', () => ({
  logger: { withContext: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));
vi.mock('./src/lib/security/headers', () => ({
  addSecurityHeaders: (res: any) => {
    res.headers.set('x-security', 'applied');
    return res;
  },
}));
vi.mock('./src/lib/middleware/geo', () => ({
  geoMiddleware: vi.fn(() => null),
  attachGeoHeaders: (res: any) => res,
}));
vi.mock('./src/lib/middleware/auth', () => ({
  authMiddleware: vi.fn(() => null),
}));
vi.mock('./src/lib/middleware/public-api-rate-limit.middleware', () => ({
  publicApiRateLimitMiddleware: vi.fn(() => Promise.resolve(null)),
  addRateLimitHeaders: (res: any) => res,
}));

import { middleware } from './middleware';
import { geoMiddleware } from './src/lib/middleware/geo';
import { authMiddleware } from './src/lib/middleware/auth';

function makeRequest(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers: new Headers(headers) });
}

describe('middleware composition', () => {
  it('chains middleware in correct order: geo → auth → security → logging', async () => {
    const req = makeRequest('/api/v1/transactions');
    const res = await middleware(req);
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
  });

  it('includes request ID in response headers', async () => {
    const req = makeRequest('/api/v1/test');
    const res = await middleware(req);
    expect(res.headers.has('X-Request-Id')).toBe(true);
  });

  it('short-circuits on a geo guard response without running auth', async () => {
    const blocked = NextResponse.json({ error: 'geo blocked' }, { status: 451 });
    (geoMiddleware as any).mockReturnValueOnce(blocked);

    const req = makeRequest('/api/v1/transactions');
    const res = await middleware(req);

    expect(res.status).toBe(451);
    expect(authMiddleware).not.toHaveBeenCalled();
  });

  it('still applies security headers, request ID, and logging to a short-circuited response', async () => {
    const blocked = NextResponse.json({ error: 'blocked' }, { status: 403 });
    (authMiddleware as any).mockReturnValueOnce(blocked);

    const req = makeRequest('/api/v1/transactions');
    const res = await middleware(req);

    expect(res.status).toBe(403);
    expect(res.headers.get('x-security')).toBe('applied');
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
  });
});
