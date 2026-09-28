export const ERROR_CODES = {
  // Validation errors (4000-4099)
  INVALID_INPUT: 'ERR_4001',
  MISSING_REQUIRED_FIELD: 'ERR_4002',
  INVALID_AMOUNT: 'ERR_4003',
  INVALID_CURRENCY: 'ERR_4004',

  // Authentication errors (4010-4019)
  UNAUTHORIZED: 'ERR_4010',
  INVALID_API_KEY: 'ERR_4011',

  // Business logic errors (4020-4099)
  INSUFFICIENT_BALANCE: 'ERR_4020',
  TRANSACTION_FAILED: 'ERR_4021',
  BRIDGE_UNAVAILABLE: 'ERR_4022',
  PAYOUT_FAILED: 'ERR_4023',

  // Server errors (5000-5099)
  INTERNAL_ERROR: 'ERR_5000',
  DATABASE_ERROR: 'ERR_5001',
  EXTERNAL_SERVICE_ERROR: 'ERR_5002',
  TIMEOUT: 'ERR_5003',
} as const;

export const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input provided',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Missing required field',
  [ERROR_CODES.INVALID_AMOUNT]: 'Invalid amount',
  [ERROR_CODES.INVALID_CURRENCY]: 'Invalid currency',
  [ERROR_CODES.UNAUTHORIZED]: 'Unauthorized access',
  [ERROR_CODES.INVALID_API_KEY]: 'Invalid API key',
  [ERROR_CODES.INSUFFICIENT_BALANCE]: 'Insufficient balance',
  [ERROR_CODES.TRANSACTION_FAILED]: 'Transaction failed',
  [ERROR_CODES.BRIDGE_UNAVAILABLE]: 'Bridge service unavailable',
  [ERROR_CODES.PAYOUT_FAILED]: 'Payout failed',
  [ERROR_CODES.INTERNAL_ERROR]: 'Internal server error',
  [ERROR_CODES.DATABASE_ERROR]: 'Database error',
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'External service error',
  [ERROR_CODES.TIMEOUT]: 'Request timeout',
};

export function getStatusCode(errorCode: string): number {
  const code = parseInt(errorCode.split('_')[1] ?? '5000');
  if (code >= 4010 && code < 4020) return 401;
  if (code >= 4000 && code < 5000) return 400;
  return 500;
}
