import { z } from 'zod';

export interface InsuranceClaimFormProps {
  transactionId: string;
  insuranceId: string;
  /** Coverage amount for display */
  coverage: number;
  onSuccess: (claimId: string) => void;
  onCancel: () => void;
}

export const CLAIM_REASONS = [
  'Transaction failed - funds not delivered',
  'Incorrect amount received',
  'Transaction reversed without refund',
  'Fraudulent or unauthorized transaction',
  'Technical error during processing',
  'Other',
];

export const insuranceClaimSchema = z.object({
  reason: z.string().min(1, 'Please select a reason'),
  evidence: z.string().max(2000, 'Evidence must be 2000 characters or less').optional(),
});
