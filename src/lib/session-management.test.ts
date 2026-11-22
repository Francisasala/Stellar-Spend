import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// Mock database pool & logger before importing service
vi.mock('./db/client', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { pool } from './db/client';
import { SessionManagementService, sessionManagementService } from './session-management';

const queryMock = pool.query as unknown as Mock;

describe('Session Management Service - Expiry & Revocation Workflow', () => {
  let sessionService: SessionManagementService;
  const mockUserAddress = 'GBXXXXXXXXUSERADDRESS12345';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    sessionService = new SessionManagementService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Session Creation & Validation', () => {
    it('should create a new session and save to database with correct expiration', async () => {
      const now = new Date('2026-07-28T12:00:00.000Z').getTime();
      vi.setSystemTime(now);

      queryMock
        .mockResolvedValueOnce({ rows: [] }) // _enforceConcurrentLimit getUserSessions
        .mockResolvedValueOnce({ rowCount: 1 }); // INSERT session

      const session = await sessionService.createSession(
        mockUserAddress,
        '192.168.1.1',
        'Mozilla/5.0',
        'device-fp-123',
      );

      expect(session.userAddress).toBe(mockUserAddress);
      expect(session.isActive).toBe(true);
      expect(session.expiresAt).toBe(now + 30 * 60 * 1000); // Default 30 min timeout
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sessions'),
        expect.arrayContaining([
          expect.stringMatching(/^session_/),
          mockUserAddress,
          expect.any(String),
          expect.any(String),
          '192.168.1.1',
          'Mozilla/5.0',
          'device-fp-123',
          true,
          now,
          now + 30 * 60 * 1000,
          now,
          0,
        ]),
      );
    });

    it('should validate an active non-expired session', async () => {
      const now = new Date('2026-07-28T12:10:00.000Z').getTime();
      const expiresAt = now + 20 * 60 * 1000;
      vi.setSystemTime(now);

      const mockSessionRow = {
        id: 'session-active-1',
        user_address: mockUserAddress,
        token: 'valid-token-123',
        refresh_token: 'refresh-token-123',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        is_active: true,
        created_at: now - 10 * 60 * 1000,
        expiresAt: expiresAt,
        expires_at: expiresAt,
        last_activity_at: now - 5 * 60 * 1000,
        activity_count: 2,
      };

      queryMock
        .mockResolvedValueOnce({ rows: [mockSessionRow] }) // SELECT session
        .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE last_activity_at

      const session = await sessionService.validateSession('valid-token-123', '192.168.1.1');

      expect(session).not.toBeNull();
      expect(session?.id).toBe('session-active-1');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions SET last_activity_at'),
        [now, 'session-active-1'],
      );
    });
  });

  describe('Session Expiry Handling', () => {
    it('should invalidate and automatically revoke an expired session upon validation', async () => {
      const now = new Date('2026-07-28T12:35:00.000Z').getTime();
      const expiresAt = now - 5 * 60 * 1000; // Expired 5 minutes ago
      vi.setSystemTime(now);

      const expiredSessionRow = {
        id: 'session-expired-1',
        user_address: mockUserAddress,
        token: 'expired-token-123',
        is_active: true,
        expires_at: expiresAt,
      };

      queryMock
        .mockResolvedValueOnce({ rows: [expiredSessionRow] }) // SELECT token
        .mockResolvedValueOnce({ rows: [{ user_address: mockUserAddress }] }) // revokeSession SELECT
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE is_active = false
        .mockResolvedValueOnce({ rowCount: 1 }); // INSERT session_revocations

      const result = await sessionService.validateSession('expired-token-123');

      expect(result).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO session_revocations'),
        expect.arrayContaining([
          expect.stringMatching(/^revocation_/),
          'session-expired-1',
          mockUserAddress,
          'Session expired',
          now,
        ]),
      );
    });

    it('should bulk cleanup all expired sessions in the database', async () => {
      const now = new Date('2026-07-28T13:00:00.000Z').getTime();
      vi.setSystemTime(now);

      queryMock.mockResolvedValueOnce({ rowCount: 4 });

      const cleanedCount = await sessionService.cleanupExpiredSessions();

      expect(cleanedCount).toBe(4);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions SET is_active = false WHERE expires_at < $1'),
        [now],
      );
    });
  });

  describe('Session Revocation & Forced Password Reset Revocation Workflow', () => {
    it('should revoke a single specific session with reason', async () => {
      const now = new Date('2026-07-28T12:15:00.000Z').getTime();
      vi.setSystemTime(now);

      queryMock
        .mockResolvedValueOnce({ rows: [{ user_address: mockUserAddress }] }) // SELECT user_address
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE is_active = false
        .mockResolvedValueOnce({ rowCount: 1 }); // INSERT session_revocations

      await sessionService.revokeSession('session-to-revoke', 'User logged out');

      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE sessions SET is_active = false WHERE id = $1',
        ['session-to-revoke'],
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO session_revocations'),
        [
          expect.stringMatching(/^revocation_/),
          'session-to-revoke',
          mockUserAddress,
          'User logged out',
          now,
        ],
      );
    });

    it('should perform forced-revocation of all user sessions in a bounded number of queries (no N+1)', async () => {
      const now = new Date('2026-07-28T12:20:00.000Z').getTime();
      vi.setSystemTime(now);

      const revokedRows = [
        { id: 'sess-device-mobile' },
        { id: 'sess-device-desktop' },
        { id: 'sess-device-tablet' },
      ];

      (pool.query as unknown as Mock)
        .mockResolvedValueOnce({ rows: revokedRows }) // UPDATE ... RETURNING id
        .mockResolvedValueOnce({ rowCount: 3 }); // bulk INSERT session_revocations

      await sessionService.revokeAllUserSessions(mockUserAddress, 'Password changed by user');

      // Exactly 2 queries regardless of how many sessions were active — no N+1.
      expect(pool.query).toHaveBeenCalledTimes(2);

      expect(pool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE sessions SET is_active = false'),
        [mockUserAddress],
      );

      const [insertSql, insertValues] = (pool.query as unknown as Mock).mock.calls[1];
      expect(insertSql).toEqual(expect.stringContaining('INSERT INTO session_revocations'));
      expect(insertValues).toEqual(
        expect.arrayContaining([
          'sess-device-mobile',
          'sess-device-desktop',
          'sess-device-tablet',
          mockUserAddress,
        ]),
      );
    });

    it('should issue no session_revocations INSERT when the user has no active sessions', async () => {
      const now = new Date('2026-07-28T12:20:00.000Z').getTime();
      vi.setSystemTime(now);

      (pool.query as unknown as Mock).mockResolvedValueOnce({ rows: [] }); // UPDATE ... RETURNING id (none)

      await sessionService.revokeAllUserSessions(mockUserAddress, 'No active sessions');

      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session Refresh & Concurrent Limits', () => {
    it('should refresh an active session extending expiration', async () => {
      const now = new Date('2026-07-28T12:25:00.000Z').getTime();
      vi.setSystemTime(now);

      const refreshRow = {
        id: 'sess-refresh-1',
        user_address: mockUserAddress,
        token: 'token-1',
        refresh_token: 'refresh-token-1',
        is_active: true,
      };

      queryMock
        .mockResolvedValueOnce({ rows: [refreshRow] }) // SELECT refresh token
        .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE expires_at, refreshed_at

      const refreshed = await sessionService.refreshSession('refresh-token-1');

      expect(refreshed).not.toBeNull();
      expect(refreshed?.expiresAt).toBe(now + 30 * 60 * 1000);
      expect(refreshed?.refreshedAt).toBe(now);
    });
  });
});

/* ============================================================================
 * Route-level integration tests (#1207)
 *
 * Verifies that the security/sessions routes delegate to the shared lib
 * module and that session expiry + rotation behave correctly end-to-end.
 * ========================================================================= */

import { POST as createSessionRoute } from '@/app/api/security/sessions/route';
import { GET as listSessionsRoute } from '@/app/api/security/sessions/route';
import { POST as refreshRoute } from '@/app/api/security/sessions/refresh/route';
import { POST as revokeRoute } from '@/app/api/security/sessions/revoke/route';
import { NextRequest } from 'next/server';

function makeRequest(
  url: string,
  opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
) {
  return new NextRequest(url, {
    method: opts.method ?? 'GET',
    headers: opts.headers ?? {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe('security/sessions routes delegate to lib (#1207)', () => {
  const user = 'GTESTUSER0000000000000000000000000000000000000000000000000';

  it('POST /sessions calls sessionManagementService.createSession', async () => {
    const spy = vi.spyOn(sessionManagementService, 'createSession').mockResolvedValue({
      id: 's1',
      userAddress: user,
      token: 'tok',
      refreshToken: 'ref',
      isActive: true,
      createdAt: 1,
      expiresAt: 2,
      lastActivityAt: 1,
      activityCount: 0,
    });

    const req = makeRequest('http://x/api/security/sessions', {
      method: 'POST',
      headers: { 'x-user-address': user, 'user-agent': 'test', 'x-forwarded-for': '1.2.3.4' },
    });

    const res = await createSessionRoute(req);
    expect(res.status).toBe(201);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe(user);
    spy.mockRestore();
  });

  it('GET /sessions calls getUserSessions', async () => {
    const spy = vi.spyOn(sessionManagementService, 'getUserSessions').mockResolvedValue([]);

    const req = makeRequest('http://x/api/security/sessions', {
      headers: { 'x-user-address': user },
    });

    const res = await listSessionsRoute(req);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(user);
    spy.mockRestore();
  });

  it('POST /sessions/refresh calls refreshSession', async () => {
    const spy = vi.spyOn(sessionManagementService, 'refreshSession').mockResolvedValue(null);

    const req = makeRequest('http://x/api/security/sessions/refresh', {
      method: 'POST',
      body: { refreshToken: 'invalid' },
    });

    const res = await refreshRoute(req);
    // null → unauthorized
    expect(res.status).toBe(401);
    expect(spy).toHaveBeenCalledWith('invalid');
    spy.mockRestore();
  });

  it('POST /sessions/revoke calls revokeSession', async () => {
    const spy = vi.spyOn(sessionManagementService, 'revokeSession').mockResolvedValue(undefined);

    const req = makeRequest('http://x/api/security/sessions/revoke', {
      method: 'POST',
      headers: { 'x-user-address': user },
      body: { sessionId: 'session_abc' },
    });

    const res = await revokeRoute(req);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith('session_abc', undefined);
    spy.mockRestore();
  });

  it('POST /sessions/revoke with revokeAll calls revokeAllUserSessions', async () => {
    const spy = vi
      .spyOn(sessionManagementService, 'revokeAllUserSessions')
      .mockResolvedValue(undefined);

    const req = makeRequest('http://x/api/security/sessions/revoke', {
      method: 'POST',
      headers: { 'x-user-address': user },
      body: { revokeAll: true, reason: 'logout everywhere' },
    });

    const res = await revokeRoute(req);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(user, 'logout everywhere');
    spy.mockRestore();
  });
});

/* ============================================================================
 * Extended branch-coverage tests for session-management.ts (#1354)
 *
 * Covers the branches missed by the first describe block:
 *   - validateSession: token not found → null
 *   - validateSession: IP consistency enforcement
 *   - refreshSession: token not found → null
 *   - trackActivity: session not found (no-op)
 *   - trackActivity: happy-path (with and without metadata)
 *   - getSessionActivity: returns mapped rows
 *   - detectSuspiciousActivity: >3 IPs emits event; stale session emits event
 *   - updateLimits / getLimits round-trip
 *   - cleanupExpiredSessions: rowCount null falls back to 0
 *   - concurrent session limit: oldest session is revoked when limit is hit
 * ========================================================================= */

describe('SessionManagementService – extended branch coverage (#1354)', () => {
  let svc: SessionManagementService;
  const USER = 'GTESTUSERBRANCH0000000000000000000000000000000000000000';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    svc = new SessionManagementService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // validateSession – token not found
  // --------------------------------------------------------------------------
  it('validateSession returns null when the token is not found', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const result = await svc.validateSession('ghost-token');
    expect(result).toBeNull();
  });

  // --------------------------------------------------------------------------
  // validateSession – IP consistency mismatch (logs warning but still returns session)
  // --------------------------------------------------------------------------
  it('validateSession emits security event on IP mismatch when enforceIpConsistency is on', async () => {
    const { logger } = await import('./logger');
    const now = Date.now();
    vi.setSystemTime(now);

    const strictSvc = new SessionManagementService({ enforceIpConsistency: true });

    const row = {
      id: 'sess-ip-1',
      user_address: USER,
      token: 'tok-ip',
      refresh_token: 'ref-ip',
      ip_address: '10.0.0.1',
      user_agent: 'ua',
      device_fingerprint: null,
      is_active: true,
      created_at: now - 1000,
      expires_at: now + 60_000,
      last_activity_at: now - 500,
      refreshed_at: null,
      activity_count: 1,
    };

    queryMock.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rowCount: 1 });

    const session = await strictSvc.validateSession('tok-ip', '10.0.0.2');

    // Session is still returned despite the mismatch.
    expect(session).not.toBeNull();
    expect(session?.id).toBe('sess-ip-1');

    // A warning must have been emitted.
    expect(logger.warn as Mock).toHaveBeenCalledWith(
      'Session security event',
      expect.objectContaining({ type: 'ip_mismatch' }),
    );
  });

  // --------------------------------------------------------------------------
  // refreshSession – token not found
  // --------------------------------------------------------------------------
  it('refreshSession returns null when the refresh token does not exist', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const result = await svc.refreshSession('bad-refresh-token');
    expect(result).toBeNull();
  });

  // --------------------------------------------------------------------------
  // trackActivity – session not found (no-op, no second query)
  // --------------------------------------------------------------------------
  it('trackActivity is a no-op when the sessionId does not exist', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    await svc.trackActivity('nonexistent-session', 'page_view');
    expect(queryMock).toHaveBeenCalledTimes(1); // only the SELECT, no INSERT
  });

  // --------------------------------------------------------------------------
  // trackActivity – happy path without metadata
  // --------------------------------------------------------------------------
  it('trackActivity inserts an activity record when the session exists (no metadata)', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    queryMock
      .mockResolvedValueOnce({ rows: [{ user_address: USER, ip_address: '1.1.1.1' }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    await svc.trackActivity('sess-1', 'deposit_initiated');

    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO session_activities'),
      expect.arrayContaining([
        expect.stringMatching(/^activity_/),
        'sess-1',
        USER,
        'deposit_initiated',
        '1.1.1.1',
        null, // no metadata
        now,
      ]),
    );
  });

  // --------------------------------------------------------------------------
  // trackActivity – happy path with metadata
  // --------------------------------------------------------------------------
  it('trackActivity serialises metadata as JSON', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    queryMock
      .mockResolvedValueOnce({ rows: [{ user_address: USER, ip_address: null }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const meta = { page: '/offramp', amount: 100 };
    await svc.trackActivity('sess-2', 'page_view', meta);

    const [, insertArgs] = queryMock.mock.calls[1];
    // metadata parameter is at index 5
    expect(insertArgs[5]).toBe(JSON.stringify(meta));
  });

  // --------------------------------------------------------------------------
  // getSessionActivity – returns mapped rows (with and without metadata/ip)
  // --------------------------------------------------------------------------
  it('getSessionActivity maps rows correctly', async () => {
    const now = Date.now();
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'act-1',
          session_id: 'sess-1',
          user_address: USER,
          action: 'login',
          ip_address: '2.2.2.2',
          metadata: JSON.stringify({ ua: 'Chrome' }),
          recorded_at: now,
        },
        {
          id: 'act-2',
          session_id: 'sess-1',
          user_address: USER,
          action: 'logout',
          ip_address: null,
          metadata: null,
          recorded_at: now + 1000,
        },
      ],
    });

    const activities = await svc.getSessionActivity('sess-1');

    expect(activities).toHaveLength(2);
    expect(activities[0]).toMatchObject({
      id: 'act-1',
      sessionId: 'sess-1',
      action: 'login',
      ipAddress: '2.2.2.2',
      metadata: { ua: 'Chrome' },
      recordedAt: now,
    });
    // ip_address null → undefined
    expect(activities[1].ipAddress).toBeUndefined();
    // metadata null → undefined
    expect(activities[1].metadata).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // detectSuspiciousActivity – >3 distinct IPs triggers event
  // --------------------------------------------------------------------------
  it('detectSuspiciousActivity reports suspicious_activity when sessions span more than 3 IPs', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const makeSess = (ip: string) => ({
      id: `sess-${ip}`,
      user_address: USER,
      token: `tok-${ip}`,
      refresh_token: null,
      ip_address: ip,
      user_agent: null,
      device_fingerprint: null,
      is_active: true,
      created_at: now - 5000,
      expires_at: now + 60_000,
      last_activity_at: now - 1000,
      refreshed_at: null,
      activity_count: 1,
    });

    // 4 distinct IPs
    const rows = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'].map(makeSess);
    queryMock.mockResolvedValueOnce({ rows });

    const events = await svc.detectSuspiciousActivity(USER);

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(
      events.some((e) => e.type === 'suspicious_activity' && e.detail.includes('4 different IP')),
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // detectSuspiciousActivity – stale session (inactive > 24h) triggers event
  // --------------------------------------------------------------------------
  it('detectSuspiciousActivity reports stale sessions inactive for over 24 hours', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const staleRow = {
      id: 'sess-stale',
      user_address: USER,
      token: 'tok-stale',
      refresh_token: null,
      ip_address: '5.5.5.5',
      user_agent: null,
      device_fingerprint: null,
      is_active: true,
      created_at: now - 48 * 60 * 60 * 1000,
      expires_at: now + 60_000,
      last_activity_at: now - 25 * 60 * 60 * 1000, // 25 hours ago
      refreshed_at: null,
      activity_count: 0,
    };

    queryMock.mockResolvedValueOnce({ rows: [staleRow] });

    const events = await svc.detectSuspiciousActivity(USER);

    expect(
      events.some((e) => e.type === 'suspicious_activity' && e.sessionId === 'sess-stale'),
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // updateLimits / getLimits round-trip
  // --------------------------------------------------------------------------
  it('updateLimits merges partial updates and getLimits reflects them', () => {
    const defaults = svc.getLimits();
    expect(defaults.maxConcurrentSessions).toBe(5);
    expect(defaults.sessionTimeoutMs).toBe(30 * 60 * 1000);

    svc.updateLimits({ maxConcurrentSessions: 10, sessionTimeoutMs: 60 * 60 * 1000 });

    const updated = svc.getLimits();
    expect(updated.maxConcurrentSessions).toBe(10);
    expect(updated.sessionTimeoutMs).toBe(60 * 60 * 1000);
    // Other fields should remain unchanged
    expect(updated.enforceIpConsistency).toBe(defaults.enforceIpConsistency);
    expect(updated.refreshTokenExpiryMs).toBe(defaults.refreshTokenExpiryMs);
  });

  it('getLimits returns a defensive copy (mutations do not affect the service)', () => {
    const limits = svc.getLimits();
    limits.maxConcurrentSessions = 999;
    expect(svc.getLimits().maxConcurrentSessions).toBe(5); // unchanged
  });

  // --------------------------------------------------------------------------
  // cleanupExpiredSessions – rowCount null falls back to 0
  // --------------------------------------------------------------------------
  it('cleanupExpiredSessions returns 0 when rowCount is null', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: null });
    const count = await svc.cleanupExpiredSessions();
    expect(count).toBe(0);
  });

  // --------------------------------------------------------------------------
  // _enforceConcurrentLimit – revokes oldest session when limit is reached
  // --------------------------------------------------------------------------
  it('createSession revokes the oldest session when the concurrent limit is reached', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const limitedSvc = new SessionManagementService({ maxConcurrentSessions: 2 });

    // Two active sessions already exist
    const existingSessions = [
      {
        id: 'sess-old',
        user_address: USER,
        token: 'tok-old',
        refresh_token: null,
        ip_address: null,
        user_agent: null,
        device_fingerprint: null,
        is_active: true,
        created_at: now - 10_000,
        expires_at: now + 60_000,
        last_activity_at: now - 5_000,
        refreshed_at: null,
        activity_count: 0,
      },
      {
        id: 'sess-newer',
        user_address: USER,
        token: 'tok-newer',
        refresh_token: null,
        ip_address: null,
        user_agent: null,
        device_fingerprint: null,
        is_active: true,
        created_at: now - 5_000,
        expires_at: now + 60_000,
        last_activity_at: now - 2_000,
        refreshed_at: null,
        activity_count: 0,
      },
    ];

    queryMock
      // _enforceConcurrentLimit → getUserSessions
      .mockResolvedValueOnce({ rows: existingSessions })
      // revokeSession → SELECT user_address
      .mockResolvedValueOnce({ rows: [{ user_address: USER }] })
      // revokeSession → UPDATE is_active
      .mockResolvedValueOnce({ rowCount: 1 })
      // revokeSession → INSERT session_revocations
      .mockResolvedValueOnce({ rowCount: 1 })
      // createSession → INSERT sessions
      .mockResolvedValueOnce({ rowCount: 1 });

    await limitedSvc.createSession(USER, '3.3.3.3', 'agent');

    // The first query is getUserSessions; the second is revokeSession's SELECT
    const revokeSelectCall = queryMock.mock.calls[1];
    expect(revokeSelectCall[1]).toContain('sess-old'); // oldest session revoked

    // The UPDATE for is_active must target the oldest session
    const revokeUpdateCall = queryMock.mock.calls[2];
    expect(revokeUpdateCall[1]).toContain('sess-old');
  });

  // --------------------------------------------------------------------------
  // revokeSession – no-op when session does not exist
  // --------------------------------------------------------------------------
  it('revokeSession is a no-op when the session does not exist', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    await svc.revokeSession('does-not-exist', 'reason');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
