import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ReactNode, useMemo, useRef, useState } from 'react';
import {
  WalletProvider,
  useWalletContext,
  useWalletConnection,
  useWalletAccount,
  useWalletTransactionsContext,
  type WalletContextValue,
} from '../WalletContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValue(overrides: Partial<WalletContextValue> = {}): WalletContextValue {
  return {
    isConnected: false,
    isConnecting: false,
    walletAddress: undefined,
    walletType: null,
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Issue #1184 — Narrow context split
// ---------------------------------------------------------------------------

describe('WalletContext – narrow context split (#1184)', () => {
  it('useWalletConnection returns only the connection slice', () => {
    const Consumer = () => {
      const { isConnected, isConnecting, onConnect, onDisconnect } = useWalletConnection();
      return (
        <div>
          <span data-testid="connected">{String(isConnected)}</span>
          <span data-testid="connecting">{String(isConnecting)}</span>
          <button data-testid="btn-connect" onClick={onConnect}>Connect</button>
          <button data-testid="btn-disconnect" onClick={onDisconnect}>Disconnect</button>
        </div>
      );
    };

    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    render(
      <WalletProvider value={makeValue({ isConnected: true, isConnecting: false, onConnect, onDisconnect })}>
        <Consumer />
      </WalletProvider>,
    );

    expect(screen.getByTestId('connected')).toHaveTextContent('true');
    expect(screen.getByTestId('connecting')).toHaveTextContent('false');

    act(() => screen.getByTestId('btn-connect').click());
    expect(onConnect).toHaveBeenCalledOnce();

    act(() => screen.getByTestId('btn-disconnect').click());
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it('useWalletAccount returns only the account identity slice', () => {
    const Consumer = () => {
      const { walletAddress, walletType } = useWalletAccount();
      return (
        <div>
          <span data-testid="address">{walletAddress ?? 'none'}</span>
          <span data-testid="type">{walletType ?? 'none'}</span>
        </div>
      );
    };

    render(
      <WalletProvider
        value={makeValue({ walletAddress: 'GTEST...1234', walletType: 'Freighter' })}
      >
        <Consumer />
      </WalletProvider>,
    );

    expect(screen.getByTestId('address')).toHaveTextContent('GTEST...1234');
    expect(screen.getByTestId('type')).toHaveTextContent('Freighter');
  });

  it('useWalletTransactionsContext is accessible and returns the transactions slice', () => {
    const Consumer = () => {
      const ctx = useWalletTransactionsContext();
      return <span data-testid="reserved">{String(ctx._reserved)}</span>;
    };

    render(
      <WalletProvider value={makeValue()}>
        <Consumer />
      </WalletProvider>,
    );

    expect(screen.getByTestId('reserved')).toHaveTextContent('true');
  });

  it('useWalletContext (backward-compat) still exposes the full aggregate', () => {
    const Consumer = () => {
      const { isConnected, walletAddress, onConnect } = useWalletContext();
      return (
        <div>
          <span data-testid="connected">{String(isConnected)}</span>
          <span data-testid="address">{walletAddress ?? 'none'}</span>
          <button data-testid="connect" onClick={onConnect}>Go</button>
        </div>
      );
    };

    const onConnect = vi.fn();
    render(
      <WalletProvider value={makeValue({ isConnected: true, walletAddress: 'GBWD...', onConnect })}>
        <Consumer />
      </WalletProvider>,
    );

    expect(screen.getByTestId('connected')).toHaveTextContent('true');
    expect(screen.getByTestId('address')).toHaveTextContent('GBWD...');
    act(() => screen.getByTestId('connect').click());
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('throws when useWalletConnection is used outside a WalletProvider', () => {
    const Bad = () => {
      try {
        useWalletConnection();
        return <span>ok</span>;
      } catch {
        return <span data-testid="err">threw</span>;
      }
    };

    render(<Bad />);
    expect(screen.getByTestId('err')).toBeInTheDocument();
  });

  it('throws when useWalletAccount is used outside a WalletProvider', () => {
    const Bad = () => {
      try {
        useWalletAccount();
        return <span>ok</span>;
      } catch {
        return <span data-testid="err">threw</span>;
      }
    };

    render(<Bad />);
    expect(screen.getByTestId('err')).toBeInTheDocument();
  });

  it('connection and account consumers are independently mounted in the same tree', () => {
    const ConnConsumer = () => {
      const { isConnected } = useWalletConnection();
      return <span data-testid="conn">{isConnected ? 'on' : 'off'}</span>;
    };
    const AccConsumer = () => {
      const { walletAddress } = useWalletAccount();
      return <span data-testid="addr">{walletAddress ?? 'none'}</span>;
    };

    render(
      <WalletProvider
        value={makeValue({ isConnected: true, walletAddress: 'GBTEST...' })}
      >
        <ConnConsumer />
        <AccConsumer />
      </WalletProvider>,
    );

    expect(screen.getByTestId('conn')).toHaveTextContent('on');
    expect(screen.getByTestId('addr')).toHaveTextContent('GBTEST...');
  });
});

// ---------------------------------------------------------------------------
// Issue #1183 — Memoization
// ---------------------------------------------------------------------------

describe('WalletContext – memoization (#1183)', () => {
  it('connection-slice value is stable when only walletAddress changes', () => {
    // The connection context value object is memoized independently of the
    // account context — so the reference should not change when only address
    // changes and callbacks remain stable.
    const capturedValues: ReturnType<typeof useWalletConnection>[] = [];

    const ConnConsumer = () => {
      const val = useWalletConnection();
      capturedValues.push(val);
      return <span data-testid="conn">conn</span>;
    };

    // Use stable callbacks outside the render so they don't change between renders
    const stableOnConnect = vi.fn();
    const stableOnDisconnect = vi.fn();

    const Wrapper = ({ address }: { address?: string }) => {
      const value = useMemo<WalletContextValue>(
        () => ({
          isConnected: true,
          isConnecting: false,
          walletAddress: address,
          walletType: 'Freighter',
          onConnect: stableOnConnect,
          onDisconnect: stableOnDisconnect,
        }),
        [address],
      );
      return (
        <WalletProvider value={value}>
          <ConnConsumer />
        </WalletProvider>
      );
    };

    const { rerender } = render(<Wrapper address="GBOLD..." />);
    // Only walletAddress changes; isConnected, isConnecting, and callbacks are stable
    rerender(<Wrapper address="GBNEW..." />);

    // We should have at least 2 captured values; the connection slice object
    // should be the same reference since nothing in that slice changed.
    expect(capturedValues.length).toBeGreaterThanOrEqual(2);
    const first = capturedValues[0];
    const last = capturedValues[capturedValues.length - 1];
    // isConnected and isConnecting are unchanged — the memoized slice is stable
    expect(first.isConnected).toBe(last.isConnected);
    expect(first.isConnecting).toBe(last.isConnecting);
    // The entire object reference is the same (memoized)
    expect(first).toBe(last);
  });

  it('account-slice value is stable when only isConnecting changes', () => {
    const capturedValues: ReturnType<typeof useWalletAccount>[] = [];

    const AccConsumer = () => {
      const val = useWalletAccount();
      capturedValues.push(val);
      return <span data-testid="acc">acc</span>;
    };

    const Wrapper = ({ connecting }: { connecting: boolean }) => {
      const value = useMemo<WalletContextValue>(
        () =>
          makeValue({
            isConnected: true,
            isConnecting: connecting,
            walletAddress: 'GB_STABLE...',
            walletType: 'Freighter',
          }),
        [connecting],
      );
      return (
        <WalletProvider value={value}>
          <AccConsumer />
        </WalletProvider>
      );
    };

    const { rerender } = render(<Wrapper connecting={false} />);
    // Only isConnecting changes — account slice (address/walletType) is unchanged
    rerender(<Wrapper connecting={true} />);

    expect(capturedValues.length).toBeGreaterThanOrEqual(2);
    const first = capturedValues[0];
    const last = capturedValues[capturedValues.length - 1];
    // walletAddress and walletType are unchanged — account slice is stable
    expect(first.walletAddress).toBe(last.walletAddress);
    expect(first.walletType).toBe(last.walletType);
    // The entire account slice object reference is the same (memoized)
    expect(first).toBe(last);
  });

  it('callbacks are stable when the parent re-renders with the same function reference', () => {
    const capturedConnects: (() => void)[] = [];

    const Consumer = () => {
      const { onConnect } = useWalletConnection();
      capturedConnects.push(onConnect);
      return <span data-testid="x">x</span>;
    };

    const stableConnect = vi.fn();
    const Wrapper = () => {
      const value = useMemo<WalletContextValue>(
        () => makeValue({ onConnect: stableConnect }),
        [], // eslint-disable-line react-hooks/exhaustive-deps
      );
      return (
        <WalletProvider value={value}>
          <Consumer />
        </WalletProvider>
      );
    };

    const { rerender } = render(<Wrapper />);
    rerender(<Wrapper />);

    // Both renders should have received the same callback reference
    expect(capturedConnects.length).toBeGreaterThanOrEqual(1);
    if (capturedConnects.length >= 2) {
      expect(capturedConnects[0]).toBe(capturedConnects[capturedConnects.length - 1]);
    }
  });

  it('whole-context consumers re-render when isConnected changes', () => {
    let renders = 0;

    const Consumer = () => {
      useWalletContext();
      renders++;
      return <span data-testid="full">full</span>;
    };

    const Wrapper = ({ connected }: { connected: boolean }) => {
      const value = useMemo<WalletContextValue>(
        () => makeValue({ isConnected: connected }),
        [connected],
      );
      return (
        <WalletProvider value={value}>
          <Consumer />
        </WalletProvider>
      );
    };

    const { rerender } = render(<Wrapper connected={false} />);
    const before = renders;
    rerender(<Wrapper connected={true} />);
    expect(renders).toBeGreaterThan(before);
  });
});
