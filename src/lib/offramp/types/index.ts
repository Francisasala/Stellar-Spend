import type { TradeState, BridgeStatus, PayoutStatus } from '@/lib/transaction-status';
export type { TradeState, BridgeStatus, PayoutStatus } from '@/lib/transaction-status';

// ── Types consolidated from shared package (#1028) ──────────────────────────
// Re-export canonical types from @stellar-spend/shared to avoid duplication.
// Only types that differ structurally for the offramp client layer are kept
// as local definitions below.

export type {
  BeneficiaryInfo,
  ExecuteRequest,
  ExecuteResponse,
  BridgeTransferRequest,
  PayoutOrderRequest,
} from '@stellar-spend/shared';

// ── Client-side types (different from shared definitions) ───────────────────

/** Subset of shared TokenInfo — offramp client does not need issuer/icon. */
export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  contract: string;
  chain: string;
}

export interface QuoteRequest {
  sourceToken: TokenInfo;
  destinationToken: TokenInfo;
  amount: string;
  isFiatInput: boolean;
  currency: string;
}

export interface QuoteResponse {
  sourceAmount: string;
  destinationAmount: string;
  bridgeFee: string;
  payoutFee: string;
  rate: number;
  estimatedTime: number;
  validUntil: Date;
}

/**
 * Client-side trade status with Date timestamps.
 * Differs from shared TradeStatus (which uses ISO string timestamps).
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
  createdAt: Date;
  updatedAt: Date;
}

/** Client-side subset — shared version also includes createdAt. */
export interface BridgeTransferResponse {
  transferId: string;
  status: BridgeStatus;
  estimatedTime: number;
}

export interface PayoutOrderResponse {
  id: string;
  receiveAddress: string;
  amount: string;
  senderFee: string;
  transactionFee: string;
  validUntil: string;
  status: PayoutStatus;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
