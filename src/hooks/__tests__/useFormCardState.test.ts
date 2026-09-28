/**
 * Tests for useFormCardState (issue #999 — raise src/hooks coverage to 85%+).
 *
 * Strategy
 * --------
 * All external calls (fetch-based services, Stellar validation helpers) are
 * mocked at the module level.  The tests drive the hook through its public API
 * and assert on the returned state and callbacks, not on implementation details.
 *
 * Coverage targets
 * ----------------
 * • Initial state
 * • resetKey side-effect (form clear)
 * • Currency initialisation (NGN auto-select)
 * • Gas-fees loading
 * • Amount change — validation branches (empty, invalid, < min, valid)
 * • fetchQuote happy path and error path
 * • Currency change triggers new quote
 * • Institution change triggers account verify
 * • Account number change triggers verify
 * • Fee method change triggers new quote
 * • touchField setter
 * • setBankMode / setRoutingNumber / setIban setters
 * • submitOfframp — guard (missing fields), guard (validation errors), happy path
 * • verifyAccount happy path and error path
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormCardState } from '../useFormCardState';

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('@/components/form-card/formCardServices', () => ({
  fetchCurrencies: vi.fn(),
  fetchGasFees: vi.fn(),
  fetchInstitutions: vi.fn(),
  fetchQuote: vi.fn(),
  verifyAccount: vi.fn(),
}));

vi.mock('@/lib/offramp', () => ({
  validateAmount: vi.fn((v: string) => /^\d+(\.\d+)?$/.test(v) && parseFloat(v) > 0),
  validateAccountNumber: vi.fn((v: string) => v.length >= 6),
}));

import * as services from '@/components/form-card/formCardServices';
import * as offrampLib from '@/lib/offramp';

const mockFetchCurrencies = vi.mocked(services.fetchCurrencies);
const mockFetchGasFees = vi.mocked(services.fetchGasFees);
const mockFetchInstitutions = vi.mocked(services.fetchInstitutions);
const mockFetchQuote = vi.mocked(services.fetchQuote);
const mockVerifyAccount = vi.mocked(services.verifyAccount);
const mockValidateAmount = vi.mocked(offrampLib.validateAmount);
const mockValidateAccountNumber = vi.mocked(offrampLib.validateAccountNumber);

// Helper: default currencies list
const CURRENCIES = [
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
];

const INSTITUTIONS = [
  { id: 'gtb', name: 'Guaranty Trust Bank', code: 'GTB' },
  { id: 'uba', name: 'United Bank for Africa', code: 'UBA' },
];

const MOCK_QUOTE = {
  destinationAmount: '158,202.00',
  rate: 1582,
  currency: 'NGN',
  bridgeFee: '0.5',
  payoutFee: '0',
  estimatedTime: 300,
};

const GAS_FEES = { native: { float: '0.001' }, stablecoin: { float: '0.5' } };

// Minimal props object used in every test
const defaultProps = {
  resetKey: 0,
  onQuoteChange: vi.fn(),
  onAmountChange: vi.fn(),
  onCurrencyChange: vi.fn(),
  onSubmit: vi.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('useFormCardState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Default happy-path resolutions for every fetch
    mockFetchCurrencies.mockResolvedValue(CURRENCIES);
    mockFetchGasFees.mockResolvedValue(GAS_FEES as any);
    mockFetchInstitutions.mockResolvedValue(INSTITUTIONS);
    mockFetchQuote.mockResolvedValue(MOCK_QUOTE as any);
    mockVerifyAccount.mockResolvedValue('John Doe');
    mockValidateAmount.mockImplementation((v: string) =>
      /^\d+(\.\d+)?$/.test(v) && parseFloat(v) > 0,
    );
    mockValidateAccountNumber.mockImplementation((v: string) => v.length >= 6);
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('returns sensible initial state', () => {
    const { result } = renderHook(() => useFormCardState(defaultProps));
    expect(result.current.amount).toBe('');
    expect(result.current.feeMethod).toBe('USDC');
    expect(result.current.currency).toBe('');
    expect(result.current.accountNumber).toBe('');
    expect(result.current.institution).toBe('');
    expect(result.current.accountName).toBe('');
    expect(result.current.quote).toBeNull();
    expect(result.current.insuranceQuote).toBeNull();
    expect(result.current.insuranceEnabled).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.amountError).toBe('');
    expect(result.current.quoteError).toBe('');
    expect(result.current.verifyError).toBe('');
  });

  // ── Currencies fetch on mount ──────────────────────────────────────────────

  it('auto-selects NGN when currencies contain it', async () => {
    const onCurrencyChange = vi.fn();
    const { result } = renderHook(() =>
      useFormCardState({ ...defaultProps, onCurrencyChange }),
    );

    await act(async () => {
      await vi.runAllTicks();
    });

    expect(result.current.currencies).toHaveLength(2);
    expect(result.current.currency).toBe('NGN');
    expect(onCurrencyChange).toHaveBeenCalledWith('NGN');
  });

  it('does not auto-select when NGN is absent', async () => {
    mockFetchCurrencies.mockResolvedValue([
      { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
    ]);
    const onCurrencyChange = vi.fn();
    const { result } = renderHook(() =>
      useFormCardState({ ...defaultProps, onCurrencyChange }),
    );

    await act(async () => {
      await vi.runAllTicks();
    });

    expect(result.current.currency).toBe('');
    expect(onCurrencyChange).not.toHaveBeenCalled();
  });

  it('handles fetchCurrencies failure gracefully', async () => {
    mockFetchCurrencies.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useFormCardState(defaultProps));

    await act(async () => {
      await vi.runAllTicks();
    });

    // Should not throw; currencies stays empty
    expect(result.current.currencies).toHaveLength(0);
  });

  // ── Gas fees fetch ─────────────────────────────────────────────────────────

  it('loads gas fees on mount', async () => {
    const { result } = renderHook(() => useFormCardState(defaultProps));

    await act(async () => {
      await vi.runAllTicks();
    });

    expect(result.current.gasFees).toEqual(GAS_FEES);
    expect(result.current.isGasFeesLoading).toBe(false);
  });

  it('sets gasFees to null when fetch fails', async () => {
    mockFetchGasFees.mockRejectedValue(new Error('unavailable'));
    const { result } = renderHook(() => useFormCardState(defaultProps));

    await act(async () => {
      await vi.runAllTicks();
    });

    expect(result.current.gasFees).toBeNull();
  });

  // ── Reset key ─────────────────────────────────────────────────────────────

  it('clears all fields when resetKey increments', async () => {
    const onQuoteChange = vi.fn();
    let resetKey = 0;
    const { result, rerender } = renderHook(({ rk }) =>
      useFormCardState({ ...defaultProps, resetKey: rk, onQuoteChange }),
      { initialProps: { rk: resetKey } },
    );

    // Populate some state
    act(() => {
      result.current.handleAmountChange('100');
    });

    await act(async () => {
      await vi.runAllTicks();
    });

    // Now increment the reset key
    resetKey = 1;
    rerender({ rk: resetKey });

    await act(async () => {
      await vi.runAllTicks();
    });

    expect(result.current.amount).toBe('');
    expect(result.current.currency).toBe('');
    expect(result.current.quote).toBeNull();
    expect(onQuoteChange).toHaveBeenCalledWith(null);
  });

  // ── Amount validation ──────────────────────────────────────────────────────

  it('clears amountError when amount is empty', async () => {
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.handleAmountChange('abc');
    });
    expect(result.current.amountError).toBe('Enter a valid number');

    act(() => {
      result.current.handleAmountChange('');
    });
    expect(result.current.amountError).toBe('');
  });

  it('sets amountError for invalid amount string', () => {
    mockValidateAmount.mockReturnValue(false);
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.handleAmountChange('abc');
    });

    expect(result.current.amountError).toBe('Enter a valid number');
  });

  it('sets amountError when amount is below 0.7 USDC minimum', () => {
    mockValidateAmount.mockReturnValue(true);
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.handleAmountChange('0.5');
    });

    expect(result.current.amountError).toBe('Minimum amount is 0.7 USDC');
  });

  it('clears amountError for a valid amount above minimum', () => {
    mockValidateAmount.mockReturnValue(true);
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.handleAmountChange('100');
    });

    expect(result.current.amountError).toBe('');
  });

  it('calls onAmountChange with new value', () => {
    const onAmountChange = vi.fn();
    const { result } = renderHook(() =>
      useFormCardState({ ...defaultProps, onAmountChange }),
    );

    act(() => {
      result.current.handleAmountChange('50');
    });

    expect(onAmountChange).toHaveBeenCalledWith('50');
  });

  // ── Quote fetching ─────────────────────────────────────────────────────────

  it('fetches quote after debounce with valid amount and currency', async () => {
    mockValidateAmount.mockReturnValue(true);
    const onQuoteChange = vi.fn();
    const { result } = renderHook(() => useFormCardState({ ...defaultProps, onQuoteChange }));

    // Set currency first
    await act(async () => {
      await vi.runAllTicks();
    });
    act(() => {
      result.current.handleCurrencyChange('NGN');
    });
    act(() => {
      result.current.handleAmountChange('100');
    });

    // Advance past 500ms debounce
    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTicks();
    });

    expect(mockFetchQuote).toHaveBeenCalled();
    expect(onQuoteChange).toHaveBeenCalledWith(expect.objectContaining({ rate: 1582 }));
    expect(result.current.quote).toEqual(expect.objectContaining({ rate: 1582 }));
  });

  it('does not fetch quote when amount is too short', async () => {
    mockValidateAmount.mockReturnValue(true);
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.handleAmountChange('0.5');
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTicks();
    });

    expect(mockFetchQuote).not.toHaveBeenCalled();
  });

  it('sets quoteError when fetchQuote throws a non-NotImplemented error', async () => {
    mockValidateAmount.mockReturnValue(true);
    mockFetchQuote.mockRejectedValue(new Error('FX rate unavailable'));
    const { result } = renderHook(() => useFormCardState(defaultProps));

    // Currency must be set before amount so the guard `!cur` passes
    act(() => {
      result.current.handleCurrencyChange('NGN');
    });
    act(() => {
      result.current.handleAmountChange('100');
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTicks();
    });

    expect(result.current.quoteError).toBe('FX rate unavailable');
    expect(result.current.quote).toBeNull();
  });

  it('does not set quoteError for Not-implemented errors', async () => {
    mockValidateAmount.mockReturnValue(true);
    mockFetchQuote.mockRejectedValue(new Error('Not implemented'));
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.handleCurrencyChange('NGN');
      result.current.handleAmountChange('100');
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTicks();
    });

    expect(result.current.quoteError).toBe('');
  });

  // ── Currency change ────────────────────────────────────────────────────────

  it('calls onCurrencyChange and fetches institutions on currency change', async () => {
    const onCurrencyChange = vi.fn();
    const { result } = renderHook(() =>
      useFormCardState({ ...defaultProps, onCurrencyChange }),
    );

    act(() => {
      result.current.handleCurrencyChange('KES');
    });

    await act(async () => {
      await vi.runAllTicks();
    });

    expect(onCurrencyChange).toHaveBeenCalledWith('KES');
    expect(mockFetchInstitutions).toHaveBeenCalledWith('KES');
    expect(result.current.institutions).toHaveLength(2);
  });

  it('clears institutions when currency is cleared', async () => {
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.handleCurrencyChange('NGN');
    });

    await act(async () => {
      await vi.runAllTicks();
    });
    expect(result.current.institutions).toHaveLength(2);

    act(() => {
      result.current.handleCurrencyChange('');
    });

    await act(async () => {
      await vi.runAllTicks();
    });
    expect(result.current.institutions).toHaveLength(0);
  });

  // ── Institution and account verify ────────────────────────────────────────

  it('clears accountName and verifyError on institution change', async () => {
    const { result } = renderHook(() => useFormCardState(defaultProps));

    // Seed an accountName first
    act(() => {
      result.current.handleCurrencyChange('NGN');
      result.current.handleAccountNumberChange('1234567890');
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await vi.runAllTicks();
    });

    act(() => {
      result.current.handleInstitutionChange('gtb');
    });

    expect(result.current.accountName).toBe('');
    expect(result.current.verifyError).toBe('');
  });

  it('triggers account verification when institution and valid account are both present', async () => {
    mockValidateAccountNumber.mockReturnValue(true);
    const { result } = renderHook(() => useFormCardState(defaultProps));

    // Set up: currency (auto-selects NGN after currencies load)
    await act(async () => {
      await vi.runAllTicks();
    });

    // Set institution
    act(() => {
      result.current.handleInstitutionChange('gtb');
    });

    // Setting account number from empty → triggers verifyAccount(accNum, institution, currency)
    act(() => {
      result.current.handleAccountNumberChange('1234567890');
    });

    // The hook's verifyAccount debounce is 400ms
    await act(async () => {
      vi.advanceTimersByTime(450);
      await vi.runAllTicks();
    });

    expect(mockVerifyAccount).toHaveBeenCalled();
    expect(result.current.accountName).toBe('John Doe');
  });

  it('sets verifyError when account verification fails', async () => {
    mockValidateAccountNumber.mockReturnValue(true);
    mockVerifyAccount.mockRejectedValue(new Error('Account not found'));
    const { result } = renderHook(() => useFormCardState(defaultProps));

    await act(async () => {
      await vi.runAllTicks();
    });

    act(() => {
      result.current.handleInstitutionChange('gtb');
    });

    act(() => {
      result.current.handleAccountNumberChange('1234567890');
    });

    await act(async () => {
      vi.advanceTimersByTime(450);
      await vi.runAllTicks();
    });

    expect(result.current.verifyError).toBe('Account not found');
    expect(result.current.accountName).toBe('');
  });

  it('does not verify when account number is invalid', async () => {
    mockValidateAccountNumber.mockReturnValue(false);
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.handleAccountNumberChange('123');
      result.current.handleInstitutionChange('gtb');
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await vi.runAllTicks();
    });

    expect(mockVerifyAccount).not.toHaveBeenCalled();
  });

  // ── Fee method ─────────────────────────────────────────────────────────────

  it('updates feeMethod and triggers quote refresh', async () => {
    mockValidateAmount.mockReturnValue(true);
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.handleCurrencyChange('NGN');
      result.current.handleAmountChange('100');
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTicks();
    });

    vi.clearAllMocks();

    act(() => {
      result.current.handleFeeMethodChange('XLM');
    });

    expect(result.current.feeMethod).toBe('XLM');

    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTicks();
    });

    expect(mockFetchQuote).toHaveBeenCalledWith('100', 'NGN', 'XLM');
  });

  // ── Misc setters ──────────────────────────────────────────────────────────

  it('touchField marks a field as touched', () => {
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.touchField('amount');
    });

    expect(result.current.touchedFields.amount).toBe(true);
  });

  it('setBankMode updates bankMode', () => {
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.setBankMode('iban');
    });

    expect(result.current.bankMode).toBe('iban');
  });

  it('setRoutingNumber updates routingNumber', () => {
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.setRoutingNumber('021000021');
    });

    expect(result.current.routingNumber).toBe('021000021');
  });

  it('setIban updates iban', () => {
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.setIban('GB29NWBK60161331926819');
    });

    expect(result.current.iban).toBe('GB29NWBK60161331926819');
  });

  it('setInsuranceEnabled updates insuranceEnabled', () => {
    const { result } = renderHook(() => useFormCardState(defaultProps));

    act(() => {
      result.current.setInsuranceEnabled(true);
    });

    expect(result.current.insuranceEnabled).toBe(true);
  });

  // ── submitOfframp ──────────────────────────────────────────────────────────

  it('submitOfframp does not call onSubmit when required fields are missing', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useFormCardState({ ...defaultProps, onSubmit }));

    await act(async () => {
      await result.current.submitOfframp();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submitOfframp does not call onSubmit when amountError is set', async () => {
    mockValidateAmount.mockReturnValue(false);
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useFormCardState({ ...defaultProps, onSubmit }));

    act(() => {
      result.current.handleAmountChange('abc');
    });

    await act(async () => {
      await result.current.submitOfframp();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submitOfframp calls onSubmit with all form data when form is valid', async () => {
    mockValidateAmount.mockReturnValue(true);
    mockValidateAccountNumber.mockReturnValue(true);
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useFormCardState({ ...defaultProps, onSubmit }));

    // Load currencies (auto-selects NGN)
    await act(async () => {
      await vi.runAllTicks();
    });

    // Set amount (triggers quote debounce)
    act(() => {
      result.current.handleAmountChange('100');
    });

    // Wait for quote debounce
    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTicks();
    });

    // Set institution first, then account number (triggers verifyAccount)
    act(() => {
      result.current.handleInstitutionChange('gtb');
    });
    act(() => {
      result.current.handleAccountNumberChange('1234567890');
    });

    // Wait for verify debounce
    await act(async () => {
      vi.advanceTimersByTime(500);
      await vi.runAllTicks();
    });

    // accountName should be set now
    expect(result.current.accountName).toBe('John Doe');

    await act(async () => {
      await result.current.submitOfframp();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '100',
        currency: 'NGN',
        institution: 'gtb',
        accountIdentifier: '1234567890',
        accountName: 'John Doe',
        feeMethod: 'USDC',
      }),
    );
  });

  it('sets isSubmitting to false after submit resolves', async () => {
    mockValidateAmount.mockReturnValue(true);
    mockValidateAccountNumber.mockReturnValue(true);
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useFormCardState({ ...defaultProps, onSubmit }));

    // Load currencies (auto-selects NGN)
    await act(async () => {
      await vi.runAllTicks();
    });

    act(() => {
      result.current.handleAmountChange('100');
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTicks();
    });

    act(() => {
      result.current.handleInstitutionChange('gtb');
    });
    act(() => {
      result.current.handleAccountNumberChange('1234567890');
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await vi.runAllTicks();
    });

    await act(async () => {
      await result.current.submitOfframp();
    });

    expect(result.current.isSubmitting).toBe(false);
  });
});
