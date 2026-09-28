import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFormCardState } from '../useFormCardState';
import * as formCardServices from '@/components/form-card/formCardServices';

vi.mock('@/components/form-card/formCardServices');
vi.mock('@/lib/offramp', () => ({
  validateAmount: (val: string) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  },
  validateAccountNumber: (acc: string) => acc.length >= 10,
}));

describe('useFormCardState - Validation Flow', () => {
  const mockCurrencies = [
    { code: 'NGN', name: 'Nigerian Naira' },
    { code: 'USD', name: 'US Dollar' },
  ];

  const mockInstitutions = [
    { id: '1', name: 'Bank A', code: 'BANKA' },
    { id: '2', name: 'Bank B', code: 'BANKB' },
  ];

  const mockQuote = {
    rate: 1200,
    totalAmount: 1200000,
    feeAmount: 1000,
    payoutAmount: 1199000,
  };

  const mockGasFees = {
    slow: '0.001',
    standard: '0.002',
    fast: '0.005',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(formCardServices.fetchCurrencies).mockResolvedValue(mockCurrencies);
    vi.mocked(formCardServices.fetchInstitutions).mockResolvedValue(mockInstitutions);
    vi.mocked(formCardServices.fetchQuote).mockResolvedValue(mockQuote);
    vi.mocked(formCardServices.fetchGasFees).mockResolvedValue(mockGasFees);
    vi.mocked(formCardServices.verifyAccount).mockResolvedValue('John Doe');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Amount Validation', () => {
    it('should validate amount input', async () => {
      const { result } = renderHook(() =>
        useFormCardState({ onAmountChange: vi.fn(), onQuoteChange: vi.fn() }),
      );

      act(() => {
        result.current.handleAmountChange('100');
      });

      expect(result.current.amount).toBe('100');
      expect(result.current.amountError).toBe('');
    });

    it('should show error for non-numeric amount', async () => {
      const { result } = renderHook(() =>
        useFormCardState({ onAmountChange: vi.fn(), onQuoteChange: vi.fn() }),
      );

      act(() => {
        result.current.handleAmountChange('abc');
      });

      expect(result.current.amountError).toBe('Enter a valid number');
    });

    it('should show error for amount below minimum', async () => {
      const { result } = renderHook(() =>
        useFormCardState({ onAmountChange: vi.fn(), onQuoteChange: vi.fn() }),
      );

      act(() => {
        result.current.handleAmountChange('0.5');
      });

      expect(result.current.amountError).toBe('Minimum amount is 0.7 USDC');
    });

    it('should clear error for valid amount', async () => {
      const { result } = renderHook(() =>
        useFormCardState({ onAmountChange: vi.fn(), onQuoteChange: vi.fn() }),
      );

      act(() => {
        result.current.handleAmountChange('0.5');
      });

      expect(result.current.amountError).not.toBe('');

      act(() => {
        result.current.handleAmountChange('100');
      });

      expect(result.current.amountError).toBe('');
    });

    it('should clear error when amount is empty', async () => {
      const { result } = renderHook(() =>
        useFormCardState({ onAmountChange: vi.fn(), onQuoteChange: vi.fn() }),
      );

      act(() => {
        result.current.handleAmountChange('0.5');
      });

      expect(result.current.amountError).not.toBe('');

      act(() => {
        result.current.handleAmountChange('');
      });

      expect(result.current.amountError).toBe('');
    });
  });

  describe('Currency Loading and Selection', () => {
    it('should load currencies on mount', async () => {
      const { result } = renderHook(() =>
        useFormCardState({ onCurrencyChange: vi.fn() }),
      );

      await waitFor(() => {
        expect(result.current.currencies).toHaveLength(2);
      });

      expect(result.current.isCurrenciesLoading).toBe(false);
    });

    it('should set default currency to NGN if available', async () => {
      const { result } = renderHook(() =>
        useFormCardState({ onCurrencyChange: vi.fn() }),
      );

      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
      });
    });

    it('should handle currency loading error gracefully', async () => {
      vi.mocked(formCardServices.fetchCurrencies).mockRejectedValueOnce(
        new Error('Fetch failed'),
      );

      const { result } = renderHook(() =>
        useFormCardState({ onCurrencyChange: vi.fn() }),
      );

      await waitFor(() => {
        expect(result.current.isCurrenciesLoading).toBe(false);
      });

      expect(result.current.currencies).toEqual([]);
    });

    it('should load institutions when currency changes', async () => {
      const onCurrencyChange = vi.fn();
      const { result } = renderHook(() =>
        useFormCardState({ onCurrencyChange }),
      );

      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
      });

      act(() => {
        result.current.handleCurrencyChange('USD');
      });

      await waitFor(() => {
        expect(result.current.institutions).toHaveLength(2);
      });

      expect(onCurrencyChange).toHaveBeenCalledWith('USD');
    });
  });

  describe('Quote Fetching with Debounce', () => {
    it('should fetch quote on valid amount change', async () => {
      const onQuoteChange = vi.fn();
      const { result } = renderHook(() =>
        useFormCardState({ onAmountChange: vi.fn(), onQuoteChange }),
      );

      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
      });

      act(() => {
        result.current.handleAmountChange('100');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.quote).toEqual(mockQuote);
      });

      expect(onQuoteChange).toHaveBeenCalledWith(mockQuote);
    });

    it('should debounce quote requests', async () => {
      const { result } = renderHook(() =>
        useFormCardState({ onAmountChange: vi.fn(), onQuoteChange: vi.fn() }),
      );

      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
      });

      act(() => {
        result.current.handleAmountChange('50');
        result.current.handleAmountChange('75');
        result.current.handleAmountChange('100');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.amount).toBe('100');
      });

      expect(vi.mocked(formCardServices.fetchQuote)).toHaveBeenCalledTimes(1);
    });

    it('should clear quote on invalid amount', async () => {
      const onQuoteChange = vi.fn();
      const { result } = renderHook(() =>
        useFormCardState({ onAmountChange: vi.fn(), onQuoteChange }),
      );

      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
      });

      act(() => {
        result.current.handleAmountChange('100');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.quote).not.toBeNull();
      });

      act(() => {
        result.current.handleAmountChange('0.5');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.quote).toBeNull();
      expect(onQuoteChange).toHaveBeenCalledWith(null);
    });

    it('should handle quote fetch error', async () => {
      vi.mocked(formCardServices.fetchQuote).mockRejectedValueOnce(
        new Error('Quote error'),
      );

      const onQuoteChange = vi.fn();
      const { result } = renderHook(() =>
        useFormCardState({ onAmountChange: vi.fn(), onQuoteChange }),
      );

      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
      });

      act(() => {
        result.current.handleAmountChange('100');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.quoteError).toBe('Quote error');
      });

      expect(result.current.quote).toBeNull();
      expect(onQuoteChange).toHaveBeenCalledWith(null);
    });
  });

  describe('Account Verification', () => {
    it('should verify account with valid input', async () => {
      const { result } = renderHook(() => useFormCardState({}));

      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
        expect(result.current.institutions).toHaveLength(2);
      });

      act(() => {
        result.current.handleInstitutionChange('1');
      });

      act(() => {
        result.current.handleAccountNumberChange('1234567890');
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(result.current.accountName).toBe('John Doe');
      });
    });

    it('should debounce account verification', async () => {
      const { result } = renderHook(() => useFormCardState({}));

      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
      });

      act(() => {
        result.current.handleAccountNumberChange('123456');
        result.current.handleAccountNumberChange('1234567890');
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(vi.mocked(formCardServices.verifyAccount)).toHaveBeenCalledTimes(1);
    });

    it('should clear verification on invalid account number', async () => {
      const { result } = renderHook(() => useFormCardState({}));

      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
      });

      act(() => {
        result.current.handleInstitutionChange('1');
        result.current.handleAccountNumberChange('1234567890');
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(result.current.accountName).toBe('John Doe');
      });

      act(() => {
        result.current.handleAccountNumberChange('123');
      });

      expect(result.current.accountName).toBe('');
    });

    it('should handle verification error', async () => {
      vi.mocked(formCardServices.verifyAccount).mockRejectedValueOnce(
        new Error('Verification failed'),
      );

      const { result } = renderHook(() => useFormCardState({}));

      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
      });

      act(() => {
        result.current.handleInstitutionChange('1');
        result.current.handleAccountNumberChange('1234567890');
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(result.current.verifyError).toBe('Verification failed');
      });

      expect(result.current.accountName).toBe('');
    });
  });

  describe('Form Reset', () => {
    it('should reset all form fields', async () => {
      const { result, rerender } = renderHook(
        ({ resetKey }: { resetKey: number }) =>
          useFormCardState({ resetKey, onQuoteChange: vi.fn() }),
        { initialProps: { resetKey: 0 } },
      );

      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
      });

      act(() => {
        result.current.handleAmountChange('100');
      });

      expect(result.current.amount).toBe('100');

      rerender({ resetKey: 1 });

      expect(result.current.amount).toBe('');
      expect(result.current.quote).toBeNull();
      expect(result.current.currency).toBe('');
    });

    it('should clear errors on reset', async () => {
      const { result, rerender } = renderHook(
        ({ resetKey }: { resetKey: number }) =>
          useFormCardState({ resetKey }),
        { initialProps: { resetKey: 0 } },
      );

      act(() => {
        result.current.handleAmountChange('0.5');
      });

      expect(result.current.amountError).not.toBe('');

      rerender({ resetKey: 1 });

      expect(result.current.amountError).toBe('');
    });

    it('should reset touched fields', async () => {
      const { result, rerender } = renderHook(
        ({ resetKey }: { resetKey: number }) =>
          useFormCardState({ resetKey }),
        { initialProps: { resetKey: 0 } },
      );

      act(() => {
        result.current.touchField('amount');
      });

      rerender({ resetKey: 1 });

      expect(result.current.touchedFields).toEqual({});
    });
  });

  describe('Gas Fees Loading', () => {
    it('should load gas fees on mount', async () => {
      const { result } = renderHook(() => useFormCardState({}));

      await waitFor(() => {
        expect(result.current.gasFees).toEqual(mockGasFees);
      });

      expect(result.current.isGasFeesLoading).toBe(false);
    });

    it('should handle gas fees loading error', async () => {
      vi.mocked(formCardServices.fetchGasFees).mockRejectedValueOnce(
        new Error('Gas fees error'),
      );

      const { result } = renderHook(() => useFormCardState({}));

      await waitFor(() => {
        expect(result.current.isGasFeesLoading).toBe(false);
      });

      expect(result.current.gasFees).toBeNull();
    });
  });

  describe('Multi-Step Validation Flow', () => {
    it('should validate complete flow: amount -> currency -> institution -> account', async () => {
      const onQuoteChange = vi.fn();
      const onCurrencyChange = vi.fn();
      const { result } = renderHook(() =>
        useFormCardState({
          onAmountChange: vi.fn(),
          onQuoteChange,
          onCurrencyChange,
        }),
      );

      // Step 1: Amount validation
      act(() => {
        result.current.handleAmountChange('100');
      });
      expect(result.current.amountError).toBe('');

      // Step 2: Currency selection (default NGN)
      await waitFor(() => {
        expect(result.current.currency).toBe('NGN');
      });

      // Step 3: Quote fetch
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.quote).not.toBeNull();
      });

      // Step 4: Institution selection
      act(() => {
        result.current.handleInstitutionChange('1');
      });

      await waitFor(() => {
        expect(result.current.institution).toBe('1');
      });

      // Step 5: Account verification
      act(() => {
        result.current.handleAccountNumberChange('1234567890');
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(result.current.accountName).toBe('John Doe');
      });
    });
  });
});
