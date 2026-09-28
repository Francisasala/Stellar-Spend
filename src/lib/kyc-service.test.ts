import { describe, it, expect, beforeEach } from 'vitest';
import { KycService } from './kyc-service';
import { KYCLimitService } from './kyc-limits';
import { SandboxKycProvider } from './kyc-provider';

function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
}

describe('KycService', () => {
  const userId = 'kyc_service_user';
  let service: KycService;

  beforeEach(() => {
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as unknown as {
        window: Record<string, unknown>;
        localStorage: ReturnType<typeof createLocalStorageMock>;
      };
      g.window = {};
      g.localStorage = createLocalStorageMock();
    }
    KYCLimitService.initializeUserLimits(userId, 'tier1');
    service = new KycService(new SandboxKycProvider());
  });

  describe('jurisdiction tier limit checks', () => {
    it('tier1 allows a small transaction', () => {
      const result = service.canTransact(userId, 100);
      expect(result.allowed).toBe(true);
    });

    it('tier1 blocks a transaction over the per-transaction limit', () => {
      const result = service.canTransact(userId, 600);
      expect(result.allowed).toBe(false);
    });

    it('reflects the tier from getUserLimits', () => {
      const limits = service.getUserLimits(userId);
      expect(limits?.tier).toBe('tier1');
    });
  });

  describe('verification level mapping per tier', () => {
    it('maps tier1 to basic verification', () => {
      const level = service.requiredVerificationLevelFor(userId, 'tier1');
      expect(level).toBe('basic');
    });

    it('maps tier2 to advanced verification', () => {
      const level = service.requiredVerificationLevelFor(userId, 'tier2');
      expect(level).toBe('advanced');
    });

    it('maps tier3 to enhanced verification', () => {
      const level = service.requiredVerificationLevelFor(userId, 'tier3');
      expect(level).toBe('enhanced');
    });

    it('describeVerificationLevel returns a human label per tier', () => {
      expect(service.describeVerificationLevel('tier2').label).toMatch(/government ID/i);
    });
  });

  describe('provider verification via the service', () => {
    it('submits verification at the level required for the requested tier', async () => {
      const result = await service.submitProviderVerification(userId, 'tier3', {});
      expect(result.success).toBe(true);
      expect(result.verificationId).toContain('enhanced');
    });

    it('checkProviderStatus returns the level that was submitted', async () => {
      const { verificationId } = await service.submitProviderVerification(userId, 'tier2', {});
      const status = await service.checkProviderStatus(verificationId);
      expect(status.level).toBe('advanced');
      expect(status.verified).toBe(true);
    });
  });

  describe('KYC lifecycle stays consistent through the single service', () => {
    it('submit -> verify -> getKYC reflects verified status', () => {
      service.submitKYC(userId, 'passport', 'doc_1');
      service.verifyKYC(userId);
      const kyc = service.getKYC(userId);
      expect(kyc?.status).toBe('verified');
    });

    it('requestLimitIncrease + approveLimitIncrease raises the tier via the service only', () => {
      const request = service.requestLimitIncrease(userId, 'tier2');
      const approved = service.approveLimitIncrease(userId, request.id);
      expect(approved).toBe(true);
      expect(service.getUserLimits(userId)?.tier).toBe('tier2');
    });
  });
});
