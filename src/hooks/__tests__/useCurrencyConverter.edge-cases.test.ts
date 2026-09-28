import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCurrencyConverter } from '../useCurrencyConverter';
import * as apiClient from '@/lib/api/client';
import { logger } from '@/lib/logger';

vi.mock('@/lib/api/client');
vi.mock('@/lib/logger');

describe('useCurrencyConverter - Edge Cases & Fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(apiClient.apiGet).mockResolvedValue({ rate: 650, currencies: ['USDC', 'NGN'] });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Amount Calculation Edge Cases', () => {
    it('should handle zero amount', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.handleFromAmountChange('0');
      });

      expect(result.current.toAmount).toBe('');
    });

    it('should handle negative amount', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.handleFromAmountChange('-100');
      });

      expect(result.current.toAmount).toBe('');
    });

    it('should handle very large amounts', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.handleFromAmountChange('999999999.99');
      });

      const expected = (999999999.99 * 650 - (999999999.99 * 0.5) / 100).toFixed(2);
      expect(result.current.toAmount).toBe(expected);
    });

    it('should handle very small amounts', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.handleFromAmountChange('0.01');
      });

      expect(result.current.toAmount).toBe('');
    });

    it('should handle decimal precision correctly', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.handleFromAmountChange('100.123456');
      });

      const toAmount = parseFloat(result.current.toAmount);
      expect(toAmount).toBeGreaterThan(0);
      expect(result.current.toAmount).toMatch(/^\d+\.\d{2}$/);
    });

    it('should handle non-numeric input gracefully', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.handleFromAmountChange('abc');
      });

      expect(result.current.toAmount).toBe('');
    });
  });

  describe('Reverse Calculation Edge Cases', () => {
    it('should calculate fromAmount when toAmount is provided', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.handleToAmountChange('100000');
      });

      expect(result.current.fromAmount).not.toBe('');
      expect(parseFloat(result.current.fromAmount)).toBeGreaterThan(0);
    });

    it('should handle zero in reverse calculation', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.handleToAmountChange('0');
      });

      expect(result.current.fromAmount).toBe('');
    });

    it('should apply reverse fee calculation correctly', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.handleToAmountChange('100000');
      });

      // Verify the reverse calculation
      const toAmount = 100000;
      const fromAmountCalculated = parseFloat(result.current.fromAmount);
      const expectedToAmount = (fromAmountCalculated * 650 - (fromAmountCalculated * 0.5) / 100);

      expect(Math.abs(expectedToAmount - toAmount)).toBeLessThan(1);
    });
  });

  describe('Currency Loading Edge Cases', () => {
    it('should handle failed currency fetch', async () => {
      vi.mocked(apiClient.apiGet).mockRejectedValueOnce(new Error('Failed to fetch'));

      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.currencies).toEqual([]);
      });

      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
        expect.stringContaining('fetch_currencies_failed'),
        expect.any(Object),
        expect.any(Error),
      );
    });

    it('should handle empty currencies response', async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValueOnce({ currencies: [] });

      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.currencies).toEqual([]);
      });
    });

    it('should handle undefined currencies in response', async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValueOnce({});

      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.currencies).toEqual([]);
      });
    });
  });

  describe('Rate Staleness & Expiration', () => {
    it('should mark rate as stale after timeout', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      expect(result.current.isStale).toBe(false);
      expect(result.current.quoteSecondsLeft).toBe(30);

      act(() => {
        vi.advanceTimersByTime(31000);
      });

      expect(result.current.isStale).toBe(true);
      expect(result.current.quoteSecondsLeft).toBe(0);
    });

    it('should count down quote seconds correctly', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      expect(result.current.quoteSecondsLeft).toBe(30);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.quoteSecondsLeft).toBe(25);

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(result.current.quoteSecondsLeft).toBe(15);
    });

    it('should reset quote timer on rate refresh', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(result.current.quoteSecondsLeft).toBe(10);

      act(async () => {
        await result.current.refreshRate();
      });

      await waitFor(() => {
        expect(result.current.quoteSecondsLeft).toBe(30);
        expect(result.current.isStale).toBe(false);
      });
    });
  });

  describe('Clipboard Operations', () => {
    it('should handle clipboard copy success', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.copyResult();
      });

      expect(result.current.copied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.copied).toBe(false);
    });

    it('should handle clipboard copy failure gracefully', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard failed')),
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.copyResult();
      });

      expect(mockClipboard.writeText).toHaveBeenCalled();
    });
  });

  describe('Rate Fetch Polling', () => {
    it('should fetch rate on mount and set up interval', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      expect(result.current.loading).toBe(false);
    });

    it('should handle rate fetch failure', async () => {
      vi.mocked(apiClient.apiGet)
        .mockResolvedValueOnce({ currencies: ['USDC', 'NGN'] })
        .mockRejectedValueOnce(new Error('Rate fetch failed'));

      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).toBeNull();
      });

      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
        expect.stringContaining('fetch_rate_failed'),
        expect.any(Object),
        expect.any(Error),
      );
    });
  });

  describe('Currency Swap Edge Cases', () => {
    it('should swap currencies and amounts correctly', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.handleFromAmountChange('100');
      });

      const originalFromCurrency = result.current.fromCurrency;
      const originalToCurrency = result.current.toCurrency;
      const originalFromAmount = result.current.fromAmount;
      const originalToAmount = result.current.toAmount;

      act(() => {
        result.current.swapCurrencies();
      });

      expect(result.current.fromCurrency).toBe(originalToCurrency);
      expect(result.current.toCurrency).toBe(originalFromCurrency);
      expect(result.current.fromAmount).toBe(originalToAmount);
      expect(result.current.toAmount).toBe(originalFromAmount);
    });

    it('should handle swap with empty amounts', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      act(() => {
        result.current.swapCurrencies();
      });

      expect(result.current.fromCurrency).not.toEqual(result.current.toCurrency);
    });
  });

  describe('Rate Updated Indicator', () => {
    it('should show rate updated indicator briefly', async () => {
      const { result } = renderHook(() => useCurrencyConverter());

      await waitFor(() => {
        expect(result.current.rate).not.toBeNull();
      });

      expect(result.current.rateUpdated).toBe(false);

      act(async () => {
        await result.current.refreshRate();
      });

      await waitFor(() => {
        expect(result.current.rateUpdated).toBe(true);
      });

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.rateUpdated).toBe(false);
    });
  });
});
