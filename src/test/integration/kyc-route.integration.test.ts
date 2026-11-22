/**
 * Integration tests for /api/kyc route — issue #1339
 *
 * Covers:
 * - Jurisdiction limits (restricted, warning, allowed) enforced at the route level
 * - Rejection messages returned with the correct shape
 * - GET ?action=limits per-user tier limits
 * - POST submit / reject lifecycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── env mock ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/env', () => ({
  env: {
    server: {
      PAYCREST_API_KEY: 'test-api-key',
      PAYCREST_WEBHOOK_SECRET: 'test-secret',
      BASE_PRIVATE_KEY: '0x0000000000000000000000000000000000000000000000000000000000000000',
      BASE_RETURN_ADDRESS: '0x0000000000000000000000000000000000000000',
      BASE_RPC_URL: 'https://sepolia.base.org',
      STELLAR_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
    },
    public: {
      NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      NEXT_PUBLIC_BASE_RETURN_ADDRESS: '0x0000000000000000000000000000000000000000',
      NEXT_PUBLIC_STELLAR_USDC_ISSUER: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ75XABZEYYWRB6HP',
    },
  },
  validateEnv: vi.fn(),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function makePost(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makePatch(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function json(res: Response) {
  return res.json();
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/kyc', () => {
  it('returns 400 when userId is missing', async () => {
    const { GET } = await import('@/app/api/kyc/route');
    const res = await GET(makeGet('http://localhost/api/kyc'));
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toBeDefined();
  });

  it('returns KYC record for a valid userId', async () => {
    const { GET } = await import('@/app/api/kyc/route');
    const res = await GET(makeGet('http://localhost/api/kyc?userId=user_test_get'));
    // 200 even if record is null — service returns { kyc: null } for new users
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveProperty('kyc');
  });

  it('returns limits for ?action=limits', async () => {
    const { GET } = await import('@/app/api/kyc/route');
    const res = await GET(makeGet('http://localhost/api/kyc?userId=user_limits&action=limits'));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveProperty('limits');
  });

  it('returns AML result for ?action=aml', async () => {
    const { GET } = await import('@/app/api/kyc/route');
    const res = await GET(makeGet('http://localhost/api/kyc?userId=user_aml&action=aml'));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveProperty('aml');
  });

  it('returns reminders for ?action=reminders', async () => {
    const { GET } = await import('@/app/api/kyc/route');
    const res = await GET(
      makeGet('http://localhost/api/kyc?userId=user_reminders&action=reminders'),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveProperty('reminders');
  });

  it('returns compliance report for ?action=compliance-report', async () => {
    const { GET } = await import('@/app/api/kyc/route');
    const now = Date.now();
    const res = await GET(
      makeGet(`http://localhost/api/kyc?action=compliance-report&from=0&to=${now}`),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveProperty('report');
  });
});

describe('POST /api/kyc — submit', () => {
  it('returns 400 when userId is missing', async () => {
    const { POST } = await import('@/app/api/kyc/route');
    const res = await POST(
      makePost('http://localhost/api/kyc', {
        action: 'submit',
        documentType: 'passport',
        documentId: 'PP123',
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toBeDefined();
  });

  it('returns 400 when documentType is missing', async () => {
    const { POST } = await import('@/app/api/kyc/route');
    const res = await POST(
      makePost('http://localhost/api/kyc', {
        action: 'submit',
        userId: 'user_submit_nodoc',
        documentId: 'PP123',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('submits KYC successfully and returns pending status', async () => {
    const { POST } = await import('@/app/api/kyc/route');
    const res = await POST(
      makePost('http://localhost/api/kyc', {
        action: 'submit',
        userId: 'user_submit_ok',
        documentType: 'passport',
        documentId: 'PP999',
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.kyc).toBeDefined();
    expect(body.kyc.status).toBe('pending');
  });

  it('returns 400 for unknown action', async () => {
    const { POST } = await import('@/app/api/kyc/route');
    const res = await POST(
      makePost('http://localhost/api/kyc', {
        action: 'unknown-action',
        userId: 'user_unknown',
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /api/kyc — upload-document', () => {
  it('uploads a document successfully', async () => {
    const { POST } = await import('@/app/api/kyc/route');
    const res = await POST(
      makePost('http://localhost/api/kyc', {
        action: 'upload-document',
        userId: 'user_upload',
        documentType: 'national_id',
        documentId: 'NID456',
        fileName: 'id.jpg',
        mimeType: 'image/jpeg',
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.upload).toBeDefined();
  });

  it('returns 400 when documentId is missing for upload', async () => {
    const { POST } = await import('@/app/api/kyc/route');
    const res = await POST(
      makePost('http://localhost/api/kyc', {
        action: 'upload-document',
        userId: 'user_upload_missing',
        documentType: 'national_id',
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/kyc — verify and reject', () => {
  beforeEach(async () => {
    // Pre-submit KYC so verify/reject have something to act on.
    const { POST } = await import('@/app/api/kyc/route');
    await POST(
      makePost('http://localhost/api/kyc', {
        action: 'submit',
        userId: 'user_patch_target',
        documentType: 'passport',
        documentId: 'PP_PATCH',
      }),
    );
  });

  it('verifies KYC and returns verified status', async () => {
    const { PATCH } = await import('@/app/api/kyc/route');
    const res = await PATCH(
      makePatch('http://localhost/api/kyc', {
        action: 'verify',
        userId: 'user_patch_target',
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.kyc.status).toBe('verified');
  });

  it('rejects KYC with a reason and returns rejected status', async () => {
    // Submit fresh for this test.
    const { POST, PATCH } = await import('@/app/api/kyc/route');
    await POST(
      makePost('http://localhost/api/kyc', {
        action: 'submit',
        userId: 'user_reject_target',
        documentType: 'passport',
        documentId: 'PP_REJECT',
      }),
    );

    const res = await PATCH(
      makePatch('http://localhost/api/kyc', {
        action: 'reject',
        userId: 'user_reject_target',
        reason: 'Document is expired',
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    // Rejection message is stored on the KYC record.
    expect(body.kyc.status).toBe('rejected');
    expect(body.kyc.rejectionReason).toBe('Document is expired');
  });

  it('returns 400 when rejecting without a reason', async () => {
    const { PATCH } = await import('@/app/api/kyc/route');
    const res = await PATCH(
      makePatch('http://localhost/api/kyc', {
        action: 'reject',
        userId: 'user_patch_target',
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toBeDefined();
  });

  it('returns 400 when userId or action is missing', async () => {
    const { PATCH } = await import('@/app/api/kyc/route');
    const res = await PATCH(makePatch('http://localhost/api/kyc', { action: 'verify' }));
    expect(res.status).toBe(400);
  });
});

describe('KYC jurisdiction limits', () => {
  it('enforces tier1 transaction limit (500 USDC)', async () => {
    const { KYCLimitService } = await import('@/lib/kyc-limits');
    KYCLimitService.initializeUserLimits('jur_tier1_user', 'tier1');

    const allowed = KYCLimitService.canTransact('jur_tier1_user', 400);
    expect(allowed.allowed).toBe(true);

    const blocked = KYCLimitService.canTransact('jur_tier1_user', 600);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/Transaction exceeds limit/i);
  });

  it('enforces tier2 transaction limit after verification', async () => {
    const { KYCLimitService } = await import('@/lib/kyc-limits');
    KYCLimitService.initializeUserLimits('jur_tier2_user', 'tier1');
    KYCLimitService.submitKYC('jur_tier2_user', 'passport', 'PP_JUR2');
    KYCLimitService.verifyKYC('jur_tier2_user');

    const allowed = KYCLimitService.canTransact('jur_tier2_user', 2000);
    expect(allowed.allowed).toBe(true);

    const blocked = KYCLimitService.canTransact('jur_tier2_user', 3000);
    expect(blocked.allowed).toBe(false);
  });

  it('NGN corridor overrides tier2 limit to 5000', async () => {
    const { KYCLimitService } = await import('@/lib/kyc-limits');
    KYCLimitService.initializeUserLimits('jur_ngn_user', 'tier1');
    KYCLimitService.submitKYC('jur_ngn_user', 'passport', 'PP_NGN');
    KYCLimitService.verifyKYC('jur_ngn_user');

    // NGN corridor bumps tier2 tx limit to 5000.
    const allowed = KYCLimitService.canTransact('jur_ngn_user', 4500, 'NGN');
    expect(allowed.allowed).toBe(true);
  });

  it('restricted jurisdictions return restricted status', async () => {
    const { getJurisdictionStatus, RESTRICTED_JURISDICTIONS } = await import('@/lib/kyc-limits');
    for (const code of RESTRICTED_JURISDICTIONS) {
      expect(getJurisdictionStatus(code)).toBe('restricted');
    }
  });

  it('warning jurisdictions return warning status', async () => {
    const { getJurisdictionStatus, WARNING_JURISDICTIONS } = await import('@/lib/kyc-limits');
    for (const code of WARNING_JURISDICTIONS) {
      expect(getJurisdictionStatus(code)).toBe('warning');
    }
  });

  it('allowed jurisdictions return allowed status', async () => {
    const { getJurisdictionStatus } = await import('@/lib/kyc-limits');
    expect(getJurisdictionStatus('NG')).toBe('allowed');
    expect(getJurisdictionStatus('KE')).toBe('allowed');
    expect(getJurisdictionStatus('GH')).toBe('allowed');
  });
});

describe('PATCH /api/kyc — limit increase', () => {
  it('requests and approves a limit increase via route', async () => {
    const { POST: kycPost } = await import('@/app/api/kyc/route');
    // Initialize user
    await kycPost(
      makePost('http://localhost/api/kyc', {
        action: 'submit',
        userId: 'user_limit_inc',
        documentType: 'passport',
        documentId: 'PP_INC',
      }),
    );

    const { PATCH } = await import('@/app/api/kyc/route');

    const reqRes = await PATCH(
      makePatch('http://localhost/api/kyc', {
        action: 'request-limit-increase',
        userId: 'user_limit_inc',
        requestedTier: 'tier2',
      }),
    );
    expect(reqRes.status).toBe(200);
    const reqBody = await json(reqRes);
    expect(reqBody.success).toBe(true);
    expect(reqBody.request.status).toBe('pending');
    const requestId = reqBody.request.id;

    const appRes = await PATCH(
      makePatch('http://localhost/api/kyc', {
        action: 'approve-limit-increase',
        userId: 'user_limit_inc',
        requestId,
      }),
    );
    expect(appRes.status).toBe(200);
    const appBody = await json(appRes);
    expect(appBody.success).toBe(true);
    expect(appBody.limits.tier).toBe('tier2');
  });

  it('returns 400 when requestedTier is missing for request-limit-increase', async () => {
    const { PATCH } = await import('@/app/api/kyc/route');
    const res = await PATCH(
      makePatch('http://localhost/api/kyc', {
        action: 'request-limit-increase',
        userId: 'user_limit_notier',
      }),
    );
    expect(res.status).toBe(400);
  });
});
