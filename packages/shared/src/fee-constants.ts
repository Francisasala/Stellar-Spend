/**
 * Shared fee calculation constants used across backend and contracts.
 * Single source of truth to prevent drift between UI estimates and on-chain results.
 */

export const FEE_CONSTANTS = {
  // Stablecoin fee percentage (0.5% = 50 basis points)
  STABLECOIN_FEE_PERCENTAGE: 0.5,
  STABLECOIN_FEE_BASIS_POINTS: 50,

  // Paycrest fee percentage (1.0% = 100 basis points)
  PAYCREST_FEE_PERCENTAGE: 1.0,
  PAYCREST_FEE_BASIS_POINTS: 100,

  // Base Stellar network fee (in XLM)
  NETWORK_FEE_XLM: '0.00001',
  NETWORK_FEE_STROOPS: 100,

  // Maximum fee rate (5% = 500 basis points)
  MAX_FEE_BASIS_POINTS: 500,
  MAX_FEE_PERCENTAGE: 5.0,
} as const;

/**
 * Calculate fee in basis points for a given amount.
 * Basis points = percentage * 100 (e.g., 50 basis points = 0.5%)
 */
export function calculateBasisPointsFee(amount: number | string, basisPoints: number): number {
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
  return (amountNum * basisPoints) / 10000;
}

/**
 * Convert percentage to basis points.
 */
export function percentageToBasisPoints(percentage: number): number {
  return percentage * 100;
}

/**
 * Validate that a basis points value is within acceptable range.
 */
export function isValidBasisPoints(basisPoints: number): boolean {
  return basisPoints >= 0 && basisPoints <= FEE_CONSTANTS.MAX_FEE_BASIS_POINTS;
}
