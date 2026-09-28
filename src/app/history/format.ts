import type { Transaction } from '@/lib/transaction-storage';
import { formatShortDateTime, getCurrencySymbol, formatUsdcAmount, truncateHash } from '@/lib/format';

// ---------------------------------------------------------------------------
// Presentation helpers shared across the history components.
// ---------------------------------------------------------------------------

export { getCurrencySymbol };

export function formatDate(timestamp: number): string {
  return formatShortDateTime(timestamp);
}

export function truncateTxHash(hash: string): string {
  return truncateHash(hash);
}

export function formatUsdc(amount: number): string {
  return formatUsdcAmount(amount);
}

export function getInsuranceStatusLabel(
  status: NonNullable<Transaction['insurance']>['status'],
): string {
  const labels: Record<NonNullable<Transaction['insurance']>['status'], string> = {
    pending: 'Pending',
    active: 'Active',
    claimed: 'Claim filed',
    claim_approved: 'Approved',
    claim_rejected: 'Rejected',
    paid: 'Paid',
  };
  return labels[status];
}

export function canFileClaim(tx: Transaction): boolean {
  return !!tx.insurance && tx.insurance.status === 'active';
}
