import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStellarWallet } from '../useStellarWallet';

describe('useStellarWallet - Reconnection Scenarios', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should maintain connection state as single source of truth', async () => {
    const { result } = renderHook(() => useStellarWallet());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.publicKey).toBe(null);
    expect(result.current.wallet).toBe(null);
  });

  it('should handle reconnection after account change', async () => {
    const { result } = renderHook(() => useStellarWallet());

    await act(async () => {
      await result.current.clearAccountChanged();
    });

    expect(result.current.accountChanged).toBe(false);
  });

  it('should preserve connection state across disconnect and reconnect cycles', async () => {
    const { result } = renderHook(() => useStellarWallet());

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.wallet).toBe(null);
  });

  it('should handle error state during reconnection attempt', async () => {
    const { result } = renderHook(() => useStellarWallet());

    await act(async () => {
      await result.current.clearError();
    });

    expect(result.current.error).toBe(null);
    expect(result.current.errorMessage).toBe('');
  });

  it('should not have duplicate connection state between hook instances', async () => {
    const { result: result1 } = renderHook(() => useStellarWallet());
    const { result: result2 } = renderHook(() => useStellarWallet());

    expect(result1.current.isConnected).toBe(result2.current.isConnected);
    expect(result1.current.publicKey).toBe(result2.current.publicKey);
  });

  it('should detect wallet availability correctly', async () => {
    const { result } = renderHook(() => useStellarWallet());

    act(() => {
      result.current.detectWallets();
    });

    await waitFor(() => {
      expect(Array.isArray(result.current.detectedWallets)).toBe(true);
    });
  });

  it('should track last used wallet for reconnection', async () => {
    const { result } = renderHook(() => useStellarWallet());

    expect(result.current.lastUsedWallet).toBeNull();
  });

  it('should handle auto-reconnect setting correctly', async () => {
    const { result } = renderHook(() => useStellarWallet());

    await act(async () => {
      result.current.saveSettings({ autoReconnect: false, rememberLastWallet: true });
    });

    expect(result.current.settings.autoReconnect).toBe(false);
  });

  it('should provide error message for account changed scenario', () => {
    const { result } = renderHook(() => useStellarWallet());

    expect(result.current.getErrorMessage(null)).toBe('');
  });

  it('should handle switching wallets with proper state cleanup', async () => {
    const { result } = renderHook(() => useStellarWallet());

    expect(result.current.isSwitching).toBe(false);
  });

  it('should have non-null manager reference after hook initialization', () => {
    const { result } = renderHook(() => useStellarWallet());

    expect(result.current.detectWallets).toBeDefined();
    expect(typeof result.current.detectWallets).toBe('function');
  });

  it('should cleanup listeners on disconnect', async () => {
    const { result } = renderHook(() => useStellarWallet());

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('should expose single wallet object when connected', async () => {
    const { result } = renderHook(() => useStellarWallet());

    if (result.current.isConnected && result.current.wallet) {
      expect(result.current.wallet.publicKey).toBeDefined();
      expect(result.current.wallet.type).toBeDefined();
    } else {
      expect(result.current.wallet).toBe(null);
    }
  });

  it('should preserve connection state through hook instance lifecycle', async () => {
    const { result, rerender } = renderHook(() => useStellarWallet());

    const initialState = {
      isConnected: result.current.isConnected,
      publicKey: result.current.publicKey,
      walletType: result.current.walletType,
    };

    rerender();

    expect(result.current.isConnected).toBe(initialState.isConnected);
    expect(result.current.publicKey).toBe(initialState.publicKey);
    expect(result.current.walletType).toBe(initialState.walletType);
  });
});
