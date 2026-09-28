/**
 * Barrel export for the transaction module group.
 *
 * Groups transaction-merge, transaction-split, transaction-search,
 * transaction-analytics, and transaction-status under a single import
 * path so call sites (e.g. src/app/api/transactions/*) can depend on
 * `@/lib/transactions` instead of five separate module paths, and so all
 * five modules share one `Transaction` type (see ./types.ts).
 */
export * from '../transaction-merge';
export * from '../transaction-split';
export * from '../transaction-search';
export * from '../transaction-analytics';
export * from '../transaction-status';
export type { Transaction } from './types';
