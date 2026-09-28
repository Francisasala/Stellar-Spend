/**
 * Compliance screening rules and override behavior documented in
 * docs/kyc-compliance-decision-boundaries.md (Compliance Screening & Overrides section)
 */

export type ScreeningVerdict = 'allow' | 'deny' | 'review';

export interface ScreeningResult {
  verdict: ScreeningVerdict;
  score: number;
  flags: string[];
  screenedAt: number;
  expiresAt: number;
  provider: string;
}

export interface ScreeningRequest {
  address: string;
  addressType: 'stellar' | 'evm' | 'bank';
  amount?: number;
  currency?: string;
}

export interface ScreeningProvider {
  readonly name: string;
  screen(request: ScreeningRequest): Promise<ScreeningResult>;
}

export class SandboxScreeningProvider implements ScreeningProvider {
  readonly name = 'sandbox';

  async screen(request: ScreeningRequest): Promise<ScreeningResult> {
    const now = Date.now();
    const flags: string[] = [];
    let score = 0;

    // Sandbox rules: flag known test addresses
    if (request.address.startsWith('G') && request.address.includes('SANDBOX_BLOCKED')) {
      score = 100;
      flags.push('sandbox_blocked_address');
    } else if (request.address.startsWith('G') && request.address.includes('SANDBOX_REVIEW')) {
      score = 60;
      flags.push('sandbox_review_address');
    } else {
      score = 0;
    }

    if (request.amount && request.amount >= 10000) {
      score = Math.min(score + 20, 100);
      flags.push('high_value');
    }

    let verdict: ScreeningVerdict = 'allow';
    if (score >= 80) verdict = 'deny';
    else if (score >= 40) verdict = 'review';

    return {
      verdict,
      score,
      flags,
      screenedAt: now,
      expiresAt: now + 15 * 60 * 1000,
      provider: this.name,
    };
  }
}

// ─── Override store ───────────────────────────────────────────────────────────

export interface ScreeningOverride {
  address: string;
  verdict: ScreeningVerdict;
  reason: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number | null;
}

const OVERRIDE_STORAGE_KEY = 'stellar_spend_screening_overrides';

function getOverrides(): ScreeningOverride[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveOverrides(overrides: ScreeningOverride[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
  }
}

export function addScreeningOverride(
  address: string,
  verdict: ScreeningVerdict,
  reason: string,
  createdBy: string,
  expiresAt?: number,
): ScreeningOverride {
  const override: ScreeningOverride = {
    address: address.toLowerCase(),
    verdict,
    reason,
    createdBy,
    createdAt: Date.now(),
    expiresAt: expiresAt ?? null,
  };
  const overrides = getOverrides().filter((o) => o.address !== address.toLowerCase());
  overrides.push(override);
  saveOverrides(overrides);
  return override;
}

export function removeScreeningOverride(address: string): void {
  const overrides = getOverrides().filter((o) => o.address !== address.toLowerCase());
  saveOverrides(overrides);
}

export function getScreeningOverrides(): ScreeningOverride[] {
  return getOverrides().filter((o) => {
    if (o.expiresAt && o.expiresAt < Date.now()) return false;
    return true;
  });
}

function findOverride(address: string): ScreeningOverride | undefined {
  return getScreeningOverrides().find((o) => o.address === address.toLowerCase());
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_KEY = 'stellar_spend_screening_cache';

function getCachedResult(address: string): ScreeningResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entry = cache[address.toLowerCase()];
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      delete cache[address.toLowerCase()];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function cacheResult(address: string, result: ScreeningResult): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[address.toLowerCase()] = result;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// ─── High-value threshold ─────────────────────────────────────────────────────

const HIGH_VALUE_THRESHOLD = 10000;

export function isHighValue(amount?: number): boolean {
  return (amount ?? 0) >= HIGH_VALUE_THRESHOLD;
}

// ─── Main screening function ──────────────────────────────────────────────────

const DEFAULT_PROVIDER: ScreeningProvider = new SandboxScreeningProvider();
let activeProvider: ScreeningProvider = DEFAULT_PROVIDER;

export function setScreeningProvider(provider: ScreeningProvider): void {
  activeProvider = provider;
}

export function getScreeningProvider(): ScreeningProvider {
  return activeProvider;
}

export interface ScreenAddressOptions {
  failClosed?: boolean;
}

export async function screenAddress(
  request: ScreeningRequest,
  options?: ScreenAddressOptions,
): Promise<ScreeningResult> {
  // Check override first
  const override = findOverride(request.address);
  if (override) {
    const now = Date.now();
    return {
      verdict: override.verdict,
      score: override.verdict === 'deny' ? 100 : 0,
      flags: [`override:${override.verdict}`],
      screenedAt: now,
      expiresAt: override.expiresAt ?? now + 24 * 60 * 60 * 1000,
      provider: 'ops_override',
    };
  }

  // Check cache
  const cached = getCachedResult(request.address);
  if (cached) return cached;

  try {
    const result = await activeProvider.screen(request);
    cacheResult(request.address, result);
    return result;
  } catch (_error) {
    const failClosed = options?.failClosed ?? isHighValue(request.amount);
    if (failClosed) {
      const now = Date.now();
      return {
        verdict: 'deny',
        score: 100,
        flags: ['screening_error_fail_closed'],
        screenedAt: now,
        expiresAt: now + 5 * 60 * 1000,
        provider: activeProvider.name,
      };
    }
    const now = Date.now();
    return {
      verdict: 'allow',
      score: 0,
      flags: ['screening_error_fail_open'],
      screenedAt: now,
      expiresAt: now + 5 * 60 * 1000,
      provider: activeProvider.name,
    };
  }
}

export function clearScreeningCache(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CACHE_KEY);
  }
}
