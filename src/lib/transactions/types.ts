/**
 * Shared Transaction type re-export for the transaction module group.
 *
 * The canonical `Transaction` shape lives in `src/lib/transaction-storage.ts`.
 * transaction-merge.ts, transaction-search.ts, and transaction-analytics.ts
 * already import it from there; this file exists so that all five sibling
 * modules (merge, split, search, analytics, status) can import one shared
 * type from a single, predictable path (`@/lib/transactions`) instead of
 * reaching into `transaction-storage.ts` directly or redefining overlapping
 * shapes locally.
 */
export type { Transaction } from '@/lib/transaction-storage';
export type { TransactionStatus, PayoutStatus, BridgeStatus, TradeState } from '@/lib/transaction-status';
