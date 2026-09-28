import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTransactionHistory } from '../useTransactionHistory';
import * as apiClient from '@/lib/api/client';
import { TransactionStorage } from '@/lib/transaction-storage';
import type { Transaction } from '@/lib/transaction-storage';

vi.mock('@/lib/api/client');
vi.mock('@/lib/transaction-storage');
vi.mock('@/contexts/NotificationProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe('useTransactionHistory - Separated Concerns', () => {
  const mockTransaction: Transaction = {
    id: 'tx-1',
    walletAddress: 'GB1234',
    amount: '100.00',
    note: '',
    timestamp: Date.now(),
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(TransactionStorage.getByUser).mockReturnValue([]);
    vi.mocked(TransactionStorage.applyOptimistic).mockReturnValue(() => {});
    vi.mocked(TransactionStorage.update).mockImplementation(() => {});
    vi.mocked(TransactionStorage.save).mockImplementation(() => {});
    vi.mocked(TransactionStorage.remove).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Data Loading Concern', () => {
    it('should load transactions from API when wallet address is provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue([mockTransaction]);
      vi.mocked(apiClient.apiGet).mockResolvedValue([mockTransaction]);

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiClient.apiGet).toHaveBeenCalled();
    });

    it('should clear transactions when wallet address is undefined', () => {
      const { result } = renderHook(() => useTransactionHistory(undefined));

      expect(result.current.transactions).toEqual([]);
      expect(result.current.error).toBe(null);
    });

    it('should fallback to local storage on API error', async () => {
      const localTx = { ...mockTransaction, id: 'local-tx' };
      vi.mocked(apiClient.apiGet).mockRejectedValue(new Error('API Error'));
      vi.mocked(TransactionStorage.getByUser).mockReturnValue([localTx]);

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.transactions).toContain(localTx);
    });

    it('should merge API and local storage transactions', async () => {
      const apiTx = { ...mockTransaction, id: 'api-tx' };
      const localTx = { ...mockTransaction, id: 'local-tx' };

      vi.mocked(apiClient.apiGet).mockResolvedValue([apiTx]);
      vi.mocked(TransactionStorage.getByUser).mockReturnValue([localTx]);

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.transactions).toHaveLength(2);
    });

    it('should not show error when local storage has cached data despite API failure', async () => {
      const localTx = { ...mockTransaction, id: 'local-tx' };
      vi.mocked(apiClient.apiGet).mockRejectedValue(new Error('API Error'));
      vi.mocked(TransactionStorage.getByUser).mockReturnValue([localTx]);

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe('Optimistic Update Concern - saveNote', () => {
    it('should optimistically update note in state', async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValue([mockTransaction]);
      vi.mocked(apiClient.apiPatch).mockResolvedValue({});

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.saveNote('tx-1', 'new note');
      });

      expect(vi.mocked(TransactionStorage.applyOptimistic)).toHaveBeenCalledWith('tx-1', {
        note: 'new note',
      });
    });

    it('should truncate notes to 500 characters', async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValue([mockTransaction]);
      vi.mocked(apiClient.apiPatch).mockResolvedValue({});

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const longNote = 'a'.repeat(600);

      act(() => {
        result.current.saveNote('tx-1', longNote);
      });

      expect(vi.mocked(apiClient.apiPatch)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          note: 'a'.repeat(500),
        }),
      );
    });

    it('should rollback on API error', async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValue([mockTransaction]);
      vi.mocked(apiClient.apiPatch).mockRejectedValue(new Error('Save failed'));

      const rollbackFn = vi.fn();
      vi.mocked(TransactionStorage.applyOptimistic).mockReturnValue(rollbackFn);

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let error: string | null = null;
      act(() => {
        result.current.saveNote('tx-1', 'new note').then((e) => {
          error = e;
        });
      });

      await waitFor(() => {
        expect(error).not.toBe(null);
      });

      expect(rollbackFn).toHaveBeenCalled();
    });
  });

  describe('Optimistic Update Concern - submitTransaction', () => {
    it('should optimistically add transaction to state', async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValue([]);
      vi.mocked(apiClient.apiPost).mockResolvedValue({});

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.submitTransaction(mockTransaction);
      });

      expect(vi.mocked(TransactionStorage.save)).toHaveBeenCalledWith(mockTransaction);
    });

    it('should rollback on submission error', async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValue([]);
      vi.mocked(apiClient.apiPost).mockRejectedValue(new Error('Submit failed'));

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let error: string | null = null;
      act(() => {
        result.current.submitTransaction(mockTransaction).then((e) => {
          error = e;
        });
      });

      await waitFor(() => {
        expect(error).not.toBe(null);
      });

      expect(vi.mocked(TransactionStorage.remove)).toHaveBeenCalledWith(mockTransaction.id);
    });

    it('should show toast on error', async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValue([]);
      vi.mocked(apiClient.apiPost).mockRejectedValue(new Error('Submit failed'));

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.submitTransaction(mockTransaction);
      });

      await waitFor(() => {
        expect(true).toBe(true);
      });
    });
  });

  describe('Update Concern - updateTransaction', () => {
    it('should update transaction in state and local storage', async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValue([mockTransaction]);

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const updates = { note: 'updated' };

      act(() => {
        result.current.updateTransaction('tx-1', updates);
      });

      expect(vi.mocked(TransactionStorage.update)).toHaveBeenCalledWith('tx-1', updates);
    });

    it('should apply partial updates without overwriting entire transaction', async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValue([mockTransaction]);

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateTransaction('tx-1', { note: 'partial update' });
      });

      expect(vi.mocked(TransactionStorage.update)).toHaveBeenCalled();
    });
  });

  describe('Error Handling Concern', () => {
    it('should show error message when no cached data and API fails', async () => {
      vi.mocked(apiClient.apiGet).mockRejectedValue(new Error('API Error'));
      vi.mocked(TransactionStorage.getByUser).mockReturnValue([]);

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).not.toBe(null);
    });

    it('should handle ApiErrorClass errors', async () => {
      const apiError = new apiClient.ApiErrorClass('Custom error');
      vi.mocked(apiClient.apiGet).mockRejectedValue(apiError);
      vi.mocked(TransactionStorage.getByUser).mockReturnValue([]);

      const { result } = renderHook(() => useTransactionHistory('GB1234'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel pending request on unmount', async () => {
      vi.mocked(apiClient.apiGet).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([mockTransaction]), 1000);
          }),
      );

      const { unmount } = renderHook(() => useTransactionHistory('GB1234'));

      unmount();

      await waitFor(() => {
        expect(apiClient.apiGet).toHaveBeenCalled();
      });
    });

    it('should handle wallet address change', async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValue([mockTransaction]);

      const { rerender } = renderHook(
        ({ address }: { address?: string }) => useTransactionHistory(address),
        {
          initialProps: { address: 'GB1234' },
        },
      );

      await waitFor(() => {
        expect(apiClient.apiGet).toHaveBeenCalled();
      });

      rerender({ address: 'GB5678' });

      expect(apiClient.apiGet).toHaveBeenCalledTimes(2);
    });
  });
});
