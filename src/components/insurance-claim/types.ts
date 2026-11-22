// Re-export shared validation schemas and constants so component code
// imports from one canonical source (src/lib/validators).
export { insuranceClaimSchema, CLAIM_REASONS, type InsuranceClaimInput } from '@/lib/validators';

export interface InsuranceClaimFormProps {
  transactionId: string;
  insuranceId: string;
  /** Coverage amount for display */
  coverage: number;
  onSuccess: (claimId: string) => void;
  onCancel: () => void;
}
