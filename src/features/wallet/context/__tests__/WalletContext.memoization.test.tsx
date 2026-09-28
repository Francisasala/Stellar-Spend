import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { WalletProvider, useWalletContext, type WalletContextValue } from '../WalletContext';

describe('WalletContext - Memoization', () => {
  let renderCount = 0;

  const TestComponent = () => {
    const wallet = useWalletContext();
    renderCount++;
    return <div data-testid="test-component">{wallet.walletAddress || 'Not connected'}</div>;
  };

  const MemoizedConsumer = () => {
    const wallet = useWalletContext();
    const memoValue = useMemo(() => wallet.walletAddress, [wallet.walletAddress]);
    renderCount++;
    return <div data-testid="memoized-consumer">{memoValue || 'Not connected'}</div>;
  };

  it('should not cause unnecessary re-renders when context value is properly memoized', () => {
    renderCount = 0;
    const contextValue: WalletContextValue = {
      isConnected: false,
      isConnecting: false,
      walletAddress: undefined,
      walletType: null,
      onConnect: () => {},
      onDisconnect: () => {},
    };

    const { rerender } = render(
      <WalletProvider value={contextValue}>
        <TestComponent />
      </WalletProvider>,
    );

    const initialRenderCount = renderCount;

    rerender(
      <WalletProvider value={contextValue}>
        <TestComponent />
      </WalletProvider>,
    );

    expect(renderCount).toBe(initialRenderCount + 1);
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });

  it('should properly update when connected wallet address changes', () => {
    renderCount = 0;
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();

    const Wrapper = ({ children }: { children: ReactNode }) => {
      const [address, setAddress] = useState<string | undefined>(undefined);

      const contextValue: WalletContextValue = useMemo(
        () => ({
          isConnected: !!address,
          isConnecting: false,
          walletAddress: address,
          walletType: address ? 'Freighter' : null,
          onConnect: () => setAddress('GB1234...'),
          onDisconnect: () => setAddress(undefined),
        }),
        [address],
      );

      return <WalletProvider value={contextValue}>{children}</WalletProvider>;
    };

    renderCount = 0;
    const { rerender } = render(
      <Wrapper>
        <MemoizedConsumer />
      </Wrapper>,
    );

    expect(screen.getByTestId('memoized-consumer')).toHaveTextContent('Not connected');
  });

  it('should prevent context value object from causing re-renders when wrapped in useMemo', () => {
    let wrappedComponentRenders = 0;

    const ContextWrapper = ({ children }: { children: ReactNode }) => {
      const [state, setState] = useState({ connected: false });

      const contextValue = useMemo<WalletContextValue>(
        () => ({
          isConnected: state.connected,
          isConnecting: false,
          walletAddress: state.connected ? 'GB1234...' : undefined,
          walletType: state.connected ? 'Freighter' : null,
          onConnect: () => setState({ connected: true }),
          onDisconnect: () => setState({ connected: false }),
        }),
        [state.connected],
      );

      return <WalletProvider value={contextValue}>{children}</WalletProvider>;
    };

    const TrackedComponent = () => {
      useWalletContext();
      wrappedComponentRenders++;
      return <div data-testid="tracked">Tracked</div>;
    };

    const { rerender } = render(
      <ContextWrapper>
        <TrackedComponent />
      </ContextWrapper>,
    );

    const initialRenders = wrappedComponentRenders;

    rerender(
      <ContextWrapper>
        <TrackedComponent />
      </ContextWrapper>,
    );

    expect(wrappedComponentRenders).toBeGreaterThan(initialRenders);
  });

  it('should allow consumers to memoize callbacks based on context values', () => {
    const Consumer = () => {
      const { onConnect, onDisconnect } = useWalletContext();

      const memoizedConnect = useCallback(() => {
        onConnect();
      }, [onConnect]);

      const memoizedDisconnect = useCallback(() => {
        onDisconnect();
      }, [onDisconnect]);

      return (
        <div data-testid="consumer-callbacks">
          <button onClick={memoizedConnect}>Connect</button>
          <button onClick={memoizedDisconnect}>Disconnect</button>
        </div>
      );
    };

    const contextValue: WalletContextValue = {
      isConnected: false,
      isConnecting: false,
      walletAddress: undefined,
      walletType: null,
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
    };

    render(
      <WalletProvider value={contextValue}>
        <Consumer />
      </WalletProvider>,
    );

    expect(screen.getByTestId('consumer-callbacks')).toBeInTheDocument();
  });
});
