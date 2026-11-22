import type { KYCStatus, LimitTier, UserLimits } from '../lib/kyc-limits';

/**
 * Client-side KYC/limits service used by {@link useKYCLimits}.
 *
 * Thin async wrapper over the `/api/kyc` route (see `src/app/api/kyc/route.ts`)
 * so hooks get promise-based access to status, limits, submissions and
 * limit-increase requests.
 */

export type { KYCStatus };
export type KYCTier = LimitTier;
export type KYCLimits = UserLimits;

export interface KYCSubmissionResult {
  status?: KYCStatus;
  limits?: KYCLimits;
}

export interface LimitIncreaseRequestResult {
  requestId?: string;
  limits?: KYCLimits;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`KYC request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

async function sendJson<T>(method: 'POST' | 'PATCH', body: unknown): Promise<T> {
  const res = await fetch('/api/kyc', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`KYC request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export class KYCLimitService {
  static async getKYCStatus(userId: string): Promise<KYCStatus> {
    const data = await getJson<{ kyc?: { status?: KYCStatus } | null }>(
      `/api/kyc?userId=${encodeURIComponent(userId)}`,
    );
    return data?.kyc?.status ?? 'unverified';
  }

  static async getUserLimits(userId: string): Promise<KYCLimits | null> {
    const data = await getJson<{ limits?: KYCLimits | null }>(
      `/api/kyc?userId=${encodeURIComponent(userId)}&action=limits`,
    );
    return data?.limits ?? null;
  }

  static async initializeLimits(userId: string): Promise<KYCLimits> {
    const existing = await this.getUserLimits(userId);
    if (existing) {
      return existing;
    }
    const now = Date.now();
    return {
      userId,
      tier: 'tier1',
      dailyUsed: 0,
      monthlyUsed: 0,
      dailyResetAt: now + 24 * 60 * 60 * 1000,
      monthlyResetAt: now + 30 * 24 * 60 * 60 * 1000,
      limitIncreaseRequests: [],
    };
  }

  static async submitKYC(
    userId: string,
    documentType: string,
    documentId: string,
  ): Promise<KYCSubmissionResult> {
    const data = await sendJson<{ kyc?: { status?: KYCStatus } }>('POST', {
      action: 'submit',
      userId,
      documentType,
      documentId,
    });
    const status = data?.kyc?.status;
    return status ? { status } : {};
  }

  static async requestLimitIncrease(
    userId: string,
    tier: KYCTier,
  ): Promise<LimitIncreaseRequestResult> {
    const data = await sendJson<{ request?: { id?: string } }>('PATCH', {
      action: 'request-limit-increase',
      userId,
      requestedTier: tier,
    });
    const requestId = data?.request?.id;
    return requestId ? { requestId } : {};
  }
}
