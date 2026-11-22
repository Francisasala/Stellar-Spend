/**
 * Shared transaction types exposed by the transactions domain.
 * The persisted Transaction shape remains canonical in transaction-storage.
 */
export type { Transaction } from '@/lib/transaction-storage';
export type {
  TransactionStatus,
  PayoutStatus,
  BridgeStatus,
  TradeState,
} from './transaction-status';
