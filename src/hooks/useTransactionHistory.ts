'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Transaction } from '@/lib/transaction-storage';
import { TransactionStorage } from '@/lib/transaction-storage';
import { apiGet, apiPatch, apiPost, ApiErrorClass } from '@/lib/api/client';
import { useToast } from '@/contexts/NotificationProvider';

export interface UseTransactionHistoryResult {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  /**
   * Optimistically save a note: updates UI + local storage immediately, persists
   * to the server, rolling both back on failure. Resolves to an error message
   * when the save fails, or `null` on success.
   */
  saveNote: (id: string, note: string) => Promise<string | null>;
  /** Patch a transaction in local state + local storage (e.g. after a claim). */
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  /**
   * Optimistically submit a new transaction: adds it to UI + local storage
   * immediately, persists to the server, rolling both back (with a toast) on
   * failure. Resolves to an error message when the submission fails, or
   * `null` on success.
   */
  submitTransaction: (transaction: Transaction) => Promise<string | null>;
}

/**
 * Owns transaction-history data fetching for a wallet: loads from the API,
 * merges with locally-stored transactions, and exposes optimistic mutators.
 *
 * Fetch failures fall back to local storage so the user still sees cached data.
 */
export function useTransactionHistory(walletAddress?: string): UseTransactionHistoryResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!walletAddress) {
      setTransactions([]);
      setError(null);
      return;
    }

    const address = walletAddress;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiGet<Transaction[]>(`/api/transactions?wallet=${encodeURIComponent(address)}`)
      .then((data) => {
        if (cancelled) return;
        const localTransactions = TransactionStorage.getByUser(address);
        const merged = new Map<string, Transaction>();
        [...data, ...localTransactions].forEach((tx) => merged.set(tx.id, tx));
        setTransactions(Array.from(merged.values()));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const localTransactions = TransactionStorage.getByUser(address);
        setTransactions(localTransactions);
        setError(
          localTransactions.length > 0
            ? null
            : err instanceof ApiErrorClass || err instanceof Error
              ? err.message
              : 'Failed to load transactions',
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const saveNote = useCallback(async (id: string, note: string): Promise<string | null> => {
    const trimmed = note.slice(0, 500);
    let previous: string | undefined;
    setTransactions((prev) => {
      previous = prev.find((tx) => tx.id === id)?.note;
      return prev.map((tx) => (tx.id === id ? { ...tx, note: trimmed } : tx));
    });
    const rollbackLocal = TransactionStorage.applyOptimistic(id, { note: trimmed });

    try {
      await apiPatch(`/api/transactions/${encodeURIComponent(id)}`, { note: trimmed });
      return null;
    } catch (err) {
      setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, note: previous } : tx)));
      rollbackLocal();
      return err instanceof ApiErrorClass || err instanceof Error
        ? err.message
        : 'Failed to save note';
    }
  }, []);

  const updateTransaction = useCallback((id: string, updates: Partial<Transaction>) => {
    setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...updates } : tx)));
    TransactionStorage.update(id, updates);
  }, []);

  /**
   * Optimistically submit a new transaction. The transaction is added to UI
   * state and local storage immediately so the user sees it right away; if
   * the server persist fails, both are rolled back and a toast surfaces the
   * failure so the user knows the submission didn't go through.
   */
  const submitTransaction = useCallback(
    async (transaction: Transaction): Promise<string | null> => {
      setTransactions((prev) => [transaction, ...prev]);
      TransactionStorage.save(transaction);

      try {
        await apiPost('/api/transactions', transaction);
        return null;
      } catch (err) {
        setTransactions((prev) => prev.filter((tx) => tx.id !== transaction.id));
        TransactionStorage.remove(transaction.id);
        const message =
          err instanceof ApiErrorClass || err instanceof Error
            ? err.message
            : 'Failed to submit transaction';
        showToast(`Transaction failed to submit: ${message}`, 'error');
        return message;
      }
    },
    [showToast],
  );

  return { transactions, isLoading, error, saveNote, updateTransaction, submitTransaction };
}
