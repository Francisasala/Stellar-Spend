import { KYCLimitService } from './kyc-limits';
import type {
  KYCData,
  UserLimits,
  AMLScreeningResult,
  ComplianceReport,
  KYCRenewalReminder,
  LimitTier,
} from './kyc-limits';
import {
  getKycProvider,
  getRequiredVerificationLevel,
  VERIFICATION_LEVEL_MAP,
  type KycProviderInterface,
  type VerificationResponse,
} from './kyc-provider';

/**
 * Single entry point that unifies limit-checking (kyc-limits.ts) and
 * identity-verification provider calls (kyc-provider.ts) behind one
 * service, so callers (the /api/kyc route, and anything else that needs
 * KYC/limit state) never talk to either module directly and can't drift
 * out of sync with each other.
 */
export class KycService {
  private readonly provider: KycProviderInterface;

  constructor(provider: KycProviderInterface = getKycProvider()) {
    this.provider = provider;
  }

  // ── Read paths ──────────────────────────────────────────────────────────

  getKYC(userId: string): KYCData | null {
    return KYCLimitService.getKYC(userId);
  }

  getUserLimits(userId: string): UserLimits | null {
    return KYCLimitService.getUserLimits(userId);
  }

  getAMLResult(userId: string): AMLScreeningResult | null {
    return KYCLimitService.getAMLResult(userId);
  }

  getKYCRenewalReminders(userId: string): KYCRenewalReminder[] {
    return KYCLimitService.getKYCRenewalReminders(userId);
  }

  generateComplianceReport(from: number, to: number): ComplianceReport {
    return KYCLimitService.generateComplianceReport(from, to);
  }

  canTransact(userId: string, amount: number) {
    return KYCLimitService.canTransact(userId, amount);
  }

  /** The verification level a provider must confirm for a jurisdiction tier. */
  requiredVerificationLevelFor(userId: string, requestedTier: LimitTier) {
    const kyc = this.getKYC(userId);
    return getRequiredVerificationLevel(kyc, requestedTier);
  }

  /** Human-readable label + mapped tier for a provider verification level. */
  describeVerificationLevel(requestedTier: LimitTier) {
    const level = getRequiredVerificationLevel(null, requestedTier);
    return VERIFICATION_LEVEL_MAP[level];
  }

  // ── Write paths (limits) ────────────────────────────────────────────────

  submitKYC(userId: string, documentType: string, documentId: string): KYCData {
    return KYCLimitService.submitKYC(userId, documentType, documentId);
  }

  verifyKYC(userId: string): KYCData | null {
    return KYCLimitService.verifyKYC(userId);
  }

  rejectKYC(userId: string, reason: string): KYCData | null {
    return KYCLimitService.rejectKYC(userId, reason);
  }

  uploadDocument(
    userId: string,
    documentType: string,
    documentId: string,
    fileName?: string,
    mimeType?: string,
  ) {
    return KYCLimitService.uploadDocument(userId, documentType, documentId, fileName, mimeType);
  }

  screenAML(userId: string, transactionAmount?: number): AMLScreeningResult {
    return KYCLimitService.screenAML(userId, transactionAmount);
  }

  requestLimitIncrease(userId: string, requestedTier: LimitTier) {
    return KYCLimitService.requestLimitIncrease(userId, requestedTier);
  }

  approveLimitIncrease(userId: string, requestId: string): boolean {
    return KYCLimitService.approveLimitIncrease(userId, requestId);
  }

  // ── Provider paths (identity verification) ──────────────────────────────

  /**
   * Kick off identity verification with the underlying provider for the
   * tier a user is requesting, using the tier→level mapping so the
   * provider is always asked for the verification level that matches the
   * jurisdiction/limit tier being requested — the one place that mapping
   * is allowed to happen.
   */
  async submitProviderVerification(
    userId: string,
    requestedTier: LimitTier,
    identityData: Record<string, unknown> = {},
  ): Promise<{ success: boolean; verificationId: string }> {
    const level = this.requiredVerificationLevelFor(userId, requestedTier);
    return this.provider.submitVerification(userId, level, identityData);
  }

  async checkProviderStatus(verificationId: string): Promise<VerificationResponse> {
    return this.provider.checkStatus(verificationId);
  }

  async requestReverification(
    userId: string,
    reason: string,
  ): Promise<{ required: boolean; message: string }> {
    return this.provider.requestReverification(userId, reason);
  }

  checkReverificationNeeded(userId: string) {
    return KYCLimitService.checkReverificationNeeded(userId);
  }

  triggerReverification(userId: string, reason: string): void {
    KYCLimitService.triggerReverification(userId, reason);
  }
}

let _kycService: KycService | null = null;

/** Singleton accessor — mirrors getTransactionQueue()'s pattern. */
export function getKycService(): KycService {
  if (!_kycService) _kycService = new KycService();
  return _kycService;
}
