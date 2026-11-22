import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../lib/api/client', () => ({
  apiPatch: vi.fn(),
}));

import { useInsuranceClaimForm } from '../useInsuranceClaimForm';
import { apiPatch } from '../../lib/api/client';

const mockedApiPatch = vi.mocked(apiPatch);

const baseOptions = {
  transactionId: 'tx-1',
  insuranceId: 'ins-1',
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

function changeEvent(files: File[]) {
  return { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>;
}

describe('useInsuranceClaimForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiPatch.mockResolvedValue({ claim: { claim_id: 'CLM-1' } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes an empty form with no errors initially', () => {
    const { result } = renderHook(() => useInsuranceClaimForm(baseOptions));

    expect(result.current.form.getValues()).toEqual({ reason: '', evidence: '' });
    expect(result.current.errors).toEqual({});
    expect(result.current.isEligible).toBe(false);
    expect(result.current.selectedFile).toBeNull();
    expect(result.current.submitError).toBeNull();
  });

  it('blocks submission while the reason is empty', async () => {
    const { result } = renderHook(() => useInsuranceClaimForm(baseOptions));

    await act(async () => {
      await result.current.handleSubmit(result.current.onSubmit)();
    });

    expect(mockedApiPatch).not.toHaveBeenCalled();
    expect(baseOptions.onSuccess).not.toHaveBeenCalled();
    expect(result.current.errors.reason).toBeTruthy();
  });

  it('rejects reasons longer than the schema limit', async () => {
    const { result } = renderHook(() => useInsuranceClaimForm(baseOptions));

    act(() => {
      result.current.form.setValue('reason', 'x'.repeat(1001));
    });

    await act(async () => {
      await result.current.handleSubmit(result.current.onSubmit)();
    });

    expect(result.current.errors.reason).toBeTruthy();
    expect(mockedApiPatch).not.toHaveBeenCalled();
  });

  it('marks the claim eligible once insuranceId is present', async () => {
    const { result } = renderHook(() => useInsuranceClaimForm(baseOptions));

    expect(result.current.isCheckingEligibility).toBe(true);
    await waitFor(() => expect(result.current.isEligible).toBe(true));
    expect(result.current.isCheckingEligibility).toBe(false);
  });

  it('stays ineligible without an insuranceId', async () => {
    const { result } = renderHook(() =>
      useInsuranceClaimForm({ ...baseOptions, insuranceId: undefined }),
    );

    await waitFor(() => expect(result.current.isCheckingEligibility).toBe(false));
    expect(result.current.isEligible).toBe(false);
  });

  it('calls onCancel when Escape is pressed', async () => {
    renderHook(() => useInsuranceClaimForm(baseOptions));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(baseOptions.onCancel).toHaveBeenCalledTimes(1);
  });

  it('selects and then removes an evidence file', async () => {
    const { result } = renderHook(() => useInsuranceClaimForm(baseOptions));

    const file = new File(['hello'], 'evidence.txt', { type: 'text/plain' });
    act(() => {
      result.current.handleFileChange(changeEvent([file]));
    });

    await waitFor(() => expect(result.current.selectedFile).toBe(file));
    await waitFor(() => expect(result.current.filePreview).toBeTruthy());

    act(() => {
      result.current.handleRemoveFile();
    });

    expect(result.current.selectedFile).toBeNull();
    expect(result.current.filePreview).toBeNull();
  });

  it('clears the pending file when an empty selection arrives', () => {
    const { result } = renderHook(() => useInsuranceClaimForm(baseOptions));

    act(() => {
      result.current.handleFileChange(changeEvent([new File(['a'], 'a.txt')]));
    });
    act(() => {
      result.current.handleFileChange(changeEvent([]));
    });

    expect(result.current.selectedFile).toBeNull();
  });

  it('submits to the real transaction route and reports success', async () => {
    const { result } = renderHook(() => useInsuranceClaimForm(baseOptions));

    await act(async () => {
      await result.current.onSubmit({ reason: 'Other', evidence: 'details' });
    });

    expect(mockedApiPatch).toHaveBeenCalledWith('/api/transactions/tx-1/insurance', {
      reason: 'Other',
      evidence: 'details',
      fileName: null,
    });
    expect(baseOptions.onSuccess).toHaveBeenCalled();
    expect(result.current.submitError).toBeNull();
  });

  it('uses the mock route for demo transactions', async () => {
    const { result } = renderHook(() =>
      useInsuranceClaimForm({ ...baseOptions, transactionId: 'demo' }),
    );

    await act(async () => {
      await result.current.onSubmit({ reason: 'Other', evidence: '' });
    });

    expect(mockedApiPatch).toHaveBeenCalledWith(
      '/api/mock/transactions/demo/insurance',
      expect.objectContaining({ reason: 'Other' }),
    );
  });

  it('records submitError when the API call fails', async () => {
    mockedApiPatch.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useInsuranceClaimForm(baseOptions));

    await act(async () => {
      await result.current.onSubmit({ reason: 'Other', evidence: '' });
    });

    expect(result.current.submitError).toBe('network down');
    expect(baseOptions.onSuccess).not.toHaveBeenCalled();
  });
});
