/**
 * Consolidated API response and DTO types (issue #968)
 * Eliminates duplicate type definitions across frontend and API.
 * Single source of truth for all API response shapes.
 */

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Generic API error response
 */
export interface ApiError {
  message: string;
  status: number;
  details?: unknown;
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Token/Asset information
 */
export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  contract: string;
  chain: string;
  issuer?: string;
  icon?: string;
}

/**
 * Currency information
 */
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  icon?: string;
  isStablecoin: boolean;
}

/**
 * Quote request for offramp/exchange
 */
export interface QuoteRequest {
  sourceToken: TokenInfo;
  destinationToken: TokenInfo;
  amount: string;
  isFiatInput: boolean;
  currency?: string;
}

/**
 * Quote response with fees and rates
 */
export interface QuoteResponse {
  quoteId: string;
  sourceAmount: string;
  destinationAmount: string;
  exchangeRate: number;
  bridgeFee: string;
  payoutFee: string;
  totalFee: string;
  estimatedTime: number;
  validUntil: string; // ISO 8601 timestamp
}

/**
 * Beneficiary bank account information
 */
export interface BeneficiaryInfo {
  institution: string;
  accountIdentifier: string;
  accountName: string;
  currency: string;
  memo?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Execute trade/payout request
 */
export interface ExecuteRequest {
  quoteId: string;
  sourceAddress: string;
  beneficiary: BeneficiaryInfo;
}

/**
 * Trade/Payout execution response
 */
export interface ExecuteResponse {
  tradeId: string;
  state: TradeState;
  sourceTxHash?: string;
  bridgeTransferId?: string;
  payoutOrderId?: string;
  destinationTxHash?: string;
}

/**
 * Trade state enumeration
 */
export enum TradeState {
  PENDING = 'PENDING',
  BRIDGE_INITIATED = 'BRIDGE_INITIATED',
  BRIDGE_IN_PROGRESS = 'BRIDGE_IN_PROGRESS',
  BRIDGE_COMPLETED = 'BRIDGE_COMPLETED',
  PAYOUT_INITIATED = 'PAYOUT_INITIATED',
  PAYOUT_IN_PROGRESS = 'PAYOUT_IN_PROGRESS',
  PAYOUT_COMPLETED = 'PAYOUT_COMPLETED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Bridge transfer status
 */
export enum BridgeStatus {
  INITIATED = 'INITIATED',
  IN_PROGRESS = 'IN_PROGRESS',
  CONFIRMING = 'CONFIRMING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Payout order status
 */
export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Trade status with full history
 */
export interface TradeStatus {
  tradeId: string;
  state: TradeState;
  sourceTxHash?: string;
  bridgeStatus?: BridgeStatus;
  bridgeTransferId?: string;
  payoutOrderId?: string;
  payoutStatus?: PayoutStatus;
  destinationTxHash?: string;
  error?: string;
  errorDetails?: Record<string, unknown>;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  completedAt?: string; // ISO 8601 timestamp
}

/**
 * Bridge transfer request
 */
export interface BridgeTransferRequest {
  amount: string;
  sourceToken: TokenInfo;
  destinationToken: TokenInfo;
  fromAddress: string;
  toAddress: string;
}

/**
 * Bridge transfer response
 */
export interface BridgeTransferResponse {
  transferId: string;
  status: BridgeStatus;
  estimatedTime: number;
  createdAt: string; // ISO 8601 timestamp
}

/**
 * Payout order request
 */
export interface PayoutOrderRequest {
  amount: number;
  token: string;
  network: string;
  rate: number;
  recipient: BeneficiaryInfo;
  reference: string;
  returnAddress: string;
}

/**
 * Payout order response
 */
export interface PayoutOrderResponse {
  id: string;
  receiveAddress: string;
  amount: string;
  senderFee: string;
  transactionFee: string;
  validUntil: string; // ISO 8601 timestamp
  status: PayoutStatus;
}

/**
 * On-chain transaction
 */
export interface OnChainTransaction {
  id: string;
  hash: string;
  type: 'payment' | 'trade' | 'contract_invocation';
  from: string;
  to?: string;
  amount: string;
  token: string;
  status: TransactionStatus;
  createdAt: string; // ISO 8601 timestamp
  confirmedAt?: string; // ISO 8601 timestamp
  failureReason?: string;
}

/**
 * Transaction status enumeration
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  CONFIRMING = 'CONFIRMING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Rate/exchange rate information
 */
export interface ExchangeRate {
  source: string;
  destination: string;
  rate: number;
  bid: number;
  ask: number;
  timestamp: string; // ISO 8601 timestamp
  source_amount: string;
  destination_amount: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string; // ISO 8601 timestamp
  services: {
    database: ServiceStatus;
    cache: ServiceStatus;
    horizon: ServiceStatus;
    soroban: ServiceStatus;
  };
  message?: string;
}

/**
 * Individual service health status
 */
export interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
}

/**
 * Wallet information
 */
export interface WalletInfo {
  address: string;
  publicKey: string;
  balances: {
    token: string;
    amount: string;
    native?: boolean;
  }[];
  sequenceNumber: string;
}

/**
 * KYC verification request
 */
export interface KycVerificationRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  nationality: string;
  countryOfResidence: string;
  address: string;
  city: string;
  postalCode: string;
  documentType: 'passport' | 'national_id' | 'drivers_license';
  documentNumber: string;
  documentExpiry?: string; // YYYY-MM-DD
}

/**
 * KYC verification status
 */
export interface KycVerificationStatus {
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  verificationId: string;
  appliedAt: string; // ISO 8601 timestamp
  completedAt?: string; // ISO 8601 timestamp
  rejectionReason?: string;
  expiresAt?: string; // ISO 8601 timestamp
}

/**
 * Fee structure
 */
export interface FeeStructure {
  bridgeFeePercent: number;
  bridgeFeeMinimum?: string;
  bridgeFeeMaximum?: string;
  payoutFeePercent: number;
  payoutFeeMinimum?: string;
  payoutFeeMaximum?: string;
}

/**
 * Available currencies/tokens response
 */
export interface AvailableCurrencies {
  fiatCurrencies: CurrencyInfo[];
  cryptoTokens: TokenInfo[];
  supportedPairs: Array<{
    source: string;
    destination: string;
  }>;
}

/**
 * Compliance screening result
 */
export interface ComplianceScreeningResult {
  passed: boolean;
  score: number;
  matches?: Array<{
    field: string;
    match_type: string;
    entity_type: string;
  }>;
  timestamp: string; // ISO 8601 timestamp
}

/**
 * API key information
 */
export interface ApiKeyInfo {
  id: string;
  name: string;
  key: string;
  createdAt: string; // ISO 8601 timestamp
  lastUsedAt?: string; // ISO 8601 timestamp
  active: boolean;
}

/**
 * Webhook event
 */
export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: string; // ISO 8601 timestamp
  data: Record<string, unknown>;
  signature?: string;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  status: number;
  timestamp: string; // ISO 8601 timestamp
  requestId?: string;
  traceId?: string;
}
