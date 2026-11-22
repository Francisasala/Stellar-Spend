import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@/services/KYCLimitService', () => ({
  KYCLimitService: {
    getKYCStatus: vi.fn(),
    getUserLimits: vi.fn(),
    initializeLimits: vi.fn(),
    submitKYC: vi.fn(),
    requestLimitIncrease: vi.fn(),
  },
}));

import { useKYCLimits } from '../useKYCLimits';
import { KYCLimitService } from '@/services/KYCLimitService';
import type { KYCLimits } from '@/services/KYCLimitService';

const mockedService = vi.mocked(KYCLimitService);

const limitsFixture: KYCLimits = {
  userId: 'user-1',
  tier: 'tier1',
  dailyUsed: 0,
  monthlyUsed: 0,
  dailyResetAt: 1_000,
  monthlyResetAt: 2_000,
  limitIncreaseRequests: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedService.getKYCStatus.mockResolvedValue('pending');
  mockedService.getUserLimits.mockResolvedValue(limitsFixture);
  mockedService.initializeLimits.mockResolvedValue(limitsFixture);
});

describe('useKYCLimits', () => {
  it('stays idle without a userId', async () => {
    const { result } = renderHook(() => useKYCLimits(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.kycStatus).toBeNull();
    expect(result.current.limits).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(mockedService.getKYCStatus).not.toHaveBeenCalled());
  });

  it('loads status and limits for a user', async () => {
    const { result } = renderHook(() => useKYCLimits('user-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockedService.getKYCStatus).toHaveBeenCalledWith('user-1');
    expect(mockedService.getUserLimits).toHaveBeenCalledWith('user-1');
    expect(result.current.kycStatus).toBe('pending');
    expect(result.current.limits).toEqual(limitsFixture);
    expect(result.current.error).toBeNull();
  });

  it('initializes limits when the user has none yet', async () => {
    mockedService.getUserLimits.mockResolvedValue(null);

    const { result } = renderHook(() => useKYCLimits('user-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockedService.initializeLimits).toHaveBeenCalledWith('user-1');
    expect(result.current.limits).toEqual(limitsFixture);
  });

  it('surfaces load failures as error state', async () => {
    mockedService.getKYCStatus.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useKYCLimits('user-1'));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.isLoading).toBe(false);
  });

  it('submitKYC throws without a user', async () => {
    const { result } = renderHook(() => useKYCLimits(undefined));

    await expect(
      act(async () => result.current.submitKYC('passport', 'ABC123')),
    ).rejects.toThrow('Cannot submit KYC without a user');
    expect(mockedService.submitKYC).not.toHaveBeenCalled();
  });

  it('submitKYC updates status and limits on success', async () => {
    mockedService.submitKYC.mockResolvedValue({
      status: 'verified',
      limits: { ...limitsFixture, tier: 'tier2' },
    });

    const { result } = renderHook(() => useKYCLimits('user-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.submitKYC('passport', 'ABC123');
    });

    expect(mockedService.submitKYC).toHaveBeenCalledWith('user-1', 'passport', 'ABC123');
    expect(result.current.kycStatus).toBe('verified');
    expect(result.current.limits?.tier).toBe('tier2');
    expect(result.current.error).toBeNull();
  });

  it('submitKYC rethrows service failures and records the error', async () => {
    mockedService.submitKYC.mockRejectedValue(new Error('submit failed'));

    const { result } = renderHook(() => useKYCLimits('user-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.submitKYC('passport', 'ABC123');
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toEqual(expect.objectContaining({ message: 'submit failed' }));
    expect(result.current.error?.message).toBe('submit failed');
    expect(result.current.isLoading).toBe(false);
  });

  it('requestLimitIncrease throws without a user', async () => {
    const { result } = renderHook(() => useKYCLimits(''));

    await expect(
      act(async () => result.current.requestLimitIncrease('tier2')),
    ).rejects.toThrow('Cannot request a limit increase without a user');
    expect(mockedService.requestLimitIncrease).not.toHaveBeenCalled();
  });

  it('requestLimitIncrease stores refreshed limits', async () => {
    const nextLimits: KYCLimits = { ...limitsFixture, tier: 'tier3' };
    mockedService.requestLimitIncrease.mockResolvedValue({ limits: nextLimits });

    const { result } = renderHook(() => useKYCLimits('user-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.requestLimitIncrease('tier3');
    });

    expect(mockedService.requestLimitIncrease).toHaveBeenCalledWith('user-1', 'tier3');
    expect(result.current.limits?.tier).toBe('tier3');
  });

  it('refetch reloads status and limits', async () => {
    const { result } = renderHook(() => useKYCLimits('user-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockedService.getKYCStatus.mockResolvedValue('verified');
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.kycStatus).toBe('verified');
    expect(mockedService.getKYCStatus).toHaveBeenCalledTimes(2);
  });
});
