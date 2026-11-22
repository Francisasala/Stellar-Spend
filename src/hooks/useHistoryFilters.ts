'use client';

import { useMemo, useState } from 'react';
import type { Transaction } from '@/lib/transaction-storage';

export type HistorySortOrder = 'newest' | 'oldest';

export interface HistoryFilters {
  /** Free-text search across id, note, and type. */
  search: string;
  /** Restrict to a single transaction type, or `null` for all. */
  type: Transaction['type'] | null;
  /** Inclusive lower bound on `timestamp` (ms), or `null` for unbounded. */
  from: number | null;
  /** Inclusive upper bound on `timestamp` (ms), or `null` for unbounded. */
  to: number | null;
  /** Sort direction by `timestamp`. */
  sort: HistorySortOrder;
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  search: '',
  type: null,
  from: null,
  to: null,
  sort: 'newest',
};

/**
 * Pure filter + sort step, extracted so it can be reused (and unit-tested)
 * independently of any React state or data fetching.
 */
export function applyHistoryFilters(
  transactions: Transaction[],
  filters: HistoryFilters,
): Transaction[] {
  const query = filters.search.trim().toLowerCase();

  const filtered = transactions.filter((tx) => {
    if (filters.type && tx.type !== filters.type) return false;
    if (filters.from !== null && tx.timestamp < filters.from) return false;
    if (filters.to !== null && tx.timestamp > filters.to) return false;
    if (query) {
      const haystack = `${tx.id} ${tx.note ?? ''} ${tx.type}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) =>
    filters.sort === 'oldest' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp,
  );
}

export interface UseHistoryFiltersResult {
  /** Current filter state. */
  filters: HistoryFilters;
  /** Replace the whole filter set. */
  setFilters: (filters: HistoryFilters) => void;
  /** Patch a subset of the filter set. */
  updateFilters: (updates: Partial<HistoryFilters>) => void;
  /** Reset back to {@link DEFAULT_HISTORY_FILTERS}. */
  resetFilters: () => void;
  /** The input list with filters + sort applied. */
  filtered: Transaction[];
  /** Backwards-compatible alias for {@link filtered}. */
  filteredTransactions: Transaction[];
}

/**
 * Reusable filter/sort concern for transaction history. Keeps filter state and
 * derives the filtered list, leaving fetching and pagination to other pieces.
 */
export function useHistoryFilters(
  transactions: Transaction[],
  initialFilters: Partial<HistoryFilters> = {},
): UseHistoryFiltersResult {
  const [filters, setFilters] = useState<HistoryFilters>({
    ...DEFAULT_HISTORY_FILTERS,
    ...initialFilters,
  });

  const updateFilters = (updates: Partial<HistoryFilters>) =>
    setFilters((prev) => ({ ...prev, ...updates }));

  const resetFilters = () => setFilters({ ...DEFAULT_HISTORY_FILTERS, ...initialFilters });

  const filtered = useMemo(
    () => applyHistoryFilters(transactions, filters),
    [transactions, filters],
  );

  return {
    filters,
    setFilters,
    updateFilters,
    resetFilters,
    filtered,
    filteredTransactions: filtered,
  };
}
