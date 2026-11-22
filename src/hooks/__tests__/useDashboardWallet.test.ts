import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardWallet } from '../useDashboardWallet';

const MOCK_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

describe('useDashboardWallet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts disconnected with no address', () => {
    const { result } = renderHook(() => useDashboardWallet());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.walletAddress).toBeUndefined();
    expect(result.current.resetKey).toBe(0);
  });

  it('moves through connecting to connected after the mock delay', () => {
    const { result } = renderHook(() => useDashboardWallet());

    act(() => {
      result.current.handleConnect();
    });
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.isConnected).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.walletAddress).toBe(MOCK_ADDRESS);
  });

  it('disconnect clears address, connection state and bumps resetKey', () => {
    const { result } = renderHook(() => useDashboardWallet());

    act(() => {
      result.current.handleConnect();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const keyBefore = result.current.resetKey;
    act(() => {
      result.current.handleDisconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.walletAddress).toBeUndefined();
    expect(result.current.resetKey).toBe(keyBefore + 1);
  });

  it('cancels a pending connect when disconnect runs first', () => {
    const { result } = renderHook(() => useDashboardWallet());

    act(() => {
      result.current.handleConnect();
    });
    act(() => {
      result.current.handleDisconnect();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.walletAddress).toBeUndefined();
  });

  it('exposes backwards-compatible connect/disconnect aliases', () => {
    const { result } = renderHook(() => useDashboardWallet());

    expect(result.current.connect).toBe(result.current.handleConnect);
    expect(result.current.disconnect).toBe(result.current.handleDisconnect);
  });

  it('clears a previous timeout when connect is called twice', () => {
    const { result } = renderHook(() => useDashboardWallet());

    act(() => {
      result.current.handleConnect();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      result.current.handleConnect();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.walletAddress).toBe(MOCK_ADDRESS);
  });
});
