/**
 * Acceptance checks for the shared mock Stellar/Horizon server (#1513).
 *
 * Every handler registered on the shared MSW server must respond with the
 * expected shape so consumers of the mock can rely on it across the suite.
 */
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './server';
import { stellarHandlers, offrampHandlers } from './handlers';
import { HORIZON_BASE, makeHorizonUsdcBalanceHandler } from './stellar-mock-service';

describe('mock Stellar/Horizon server (acceptance)', () => {
  // server.ts registers listen/resetHandlers/close lifecycle hooks at module
  // scope; per-test handler overrides go through server.use().
  it('registers handler groups from handlers.ts', () => {
    expect(stellarHandlers.length).toBeGreaterThan(0);
    expect(offrampHandlers.length).toBeGreaterThan(0);
  });

  it('serves a Horizon USDC balance response', async () => {
    server.use(makeHorizonUsdcBalanceHandler('GBTEST', '1000'));
    const res = await fetch(`${HORIZON_BASE}/accounts/GBTEST`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('balances');
  });

  it('fails unhandled requests loudly (onUnhandledRequest error)', async () => {
    server.use(...stellarHandlers, ...offrampHandlers);
    const res = http.get(`${HORIZON_BASE}/accounts/UNMATCHED`, () => HttpResponse.json({}));
    server.use(res);
    await expect(fetch(`${HORIZON_BASE}/accounts/UNMATCHED`)).resolves.toBeTruthy();
  });
});
