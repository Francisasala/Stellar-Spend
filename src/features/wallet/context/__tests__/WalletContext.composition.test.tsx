import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactNode, useMemo } from 'react';
import { WalletProvider, useWalletContext, type WalletContextValue } from '../WalletContext';

describe('WalletContext - Provider Composition', () => {
  it('should split context into narrower concerns (connection state)', () => {
    const ConnectionConsumer = () => {
      const { isConnected, isConnecting, onConnect, onDisconnect } = useWalletContext();
      return (
        <div data-testid="connection-consumer">
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          <span>{isConnecting ? 'Connecting...' : 'Ready'}</span>
          <button onClick={onConnect}>Connect</button>
          <button onClick={onDisconnect}>Disconnect</button>
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
        <ConnectionConsumer />
      </WalletProvider>,
    );

    expect(screen.getByTestId('connection-consumer')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('should split context into narrower concerns (balance/account state)', () => {
    const BalanceConsumer = () => {
      const { walletAddress, walletType } = useWalletContext();
      return (
        <div data-testid="balance-consumer">
          <span>{walletAddress || 'No wallet'}</span>
          <span>{walletType || 'Unknown type'}</span>
        </div>
      );
    };

    const contextValue: WalletContextValue = {
      isConnected: true,
      isConnecting: false,
      walletAddress: 'GB123...',
      walletType: 'Freighter',
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
    };

    render(
      <WalletProvider value={contextValue}>
        <BalanceConsumer />
      </WalletProvider>,
    );

    expect(screen.getByTestId('balance-consumer')).toBeInTheDocument();
    expect(screen.getByText('GB123...')).toBeInTheDocument();
    expect(screen.getByText('Freighter')).toBeInTheDocument();
  });

  it('should allow multiple consumers to subscribe independently without cross-subscription', () => {
    const ConnectionConsumer = () => {
      const { isConnected } = useWalletContext();
      return <div data-testid="connection">{isConnected ? 'Connected' : 'Disconnected'}</div>;
    };

    const BalanceConsumer = () => {
      const { walletAddress } = useWalletContext();
      return <div data-testid="balance">{walletAddress || 'No address'}</div>;
    };

    const contextValue: WalletContextValue = {
      isConnected: true,
      isConnecting: false,
      walletAddress: 'GB456...',
      walletType: 'Lobstr',
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
    };

    render(
      <WalletProvider value={contextValue}>
        <ConnectionConsumer />
        <BalanceConsumer />
      </WalletProvider>,
    );

    expect(screen.getByTestId('connection')).toHaveTextContent('Connected');
    expect(screen.getByTestId('balance')).toHaveTextContent('GB456...');
  });

  it('should support nested providers with different values', () => {
    const Display = () => {
      const { walletAddress } = useWalletContext();
      return <div data-testid="display">{walletAddress}</div>;
    };

    const InnerProvider = ({ children }: { children: ReactNode }) => {
      const innerValue: WalletContextValue = {
        isConnected: true,
        isConnecting: false,
        walletAddress: 'GB789...',
        walletType: 'Freighter',
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
      };

      return <WalletProvider value={innerValue}>{children}</WalletProvider>;
    };

    const outerValue: WalletContextValue = {
      isConnected: false,
      isConnecting: false,
      walletAddress: 'GBabc...',
      walletType: null,
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
    };

    render(
      <WalletProvider value={outerValue}>
        <InnerProvider>
          <Display />
        </InnerProvider>
      </WalletProvider>,
    );

    expect(screen.getByTestId('display')).toHaveTextContent('GB789...');
  });

  it('should memoize context value to prevent unnecessary re-renders in composed consumers', () => {
    let connectionRenders = 0;
    let balanceRenders = 0;

    const ConnectionConsumer = () => {
      const { isConnected } = useWalletContext();
      connectionRenders++;
      return <div data-testid="conn">{isConnected ? 'On' : 'Off'}</div>;
    };

    const BalanceConsumer = () => {
      const { walletAddress } = useWalletContext();
      balanceRenders++;
      return <div data-testid="bal">{walletAddress}</div>;
    };

    const ComposedProvider = ({ children }: { children: ReactNode }) => {
      const value = useMemo<WalletContextValue>(
        () => ({
          isConnected: true,
          isConnecting: false,
          walletAddress: 'GB123...',
          walletType: 'Freighter',
          onConnect: () => {},
          onDisconnect: () => {},
        }),
        [],
      );

      return <WalletProvider value={value}>{children}</WalletProvider>;
    };

    const { rerender } = render(
      <ComposedProvider>
        <ConnectionConsumer />
        <BalanceConsumer />
      </ComposedProvider>,
    );

    const initialConnRenders = connectionRenders;
    const initialBalRenders = balanceRenders;

    rerender(
      <ComposedProvider>
        <ConnectionConsumer />
        <BalanceConsumer />
      </ComposedProvider>,
    );

    expect(connectionRenders).toBe(initialConnRenders + 1);
    expect(balanceRenders).toBe(initialBalRenders + 1);
  });

  it('should handle error when useWalletContext is used outside provider', () => {
    const ConsumerWithoutProvider = () => {
      try {
        useWalletContext();
        return <div data-testid="should-not-render">Error</div>;
      } catch (error) {
        return <div data-testid="error-caught">Provider required</div>;
      }
    };

    render(<ConsumerWithoutProvider />);
    expect(screen.getByTestId('error-caught')).toBeInTheDocument();
  });

  it('should properly isolate context subscribers from unrelated state changes', () => {
    const WalletAddressConsumer = () => {
      const { walletAddress } = useWalletContext();
      return <span data-testid="address">{walletAddress}</span>;
    };

    const ConnectionStatusConsumer = () => {
      const { isConnected } = useWalletContext();
      return <span data-testid="status">{isConnected ? 'Connected' : 'Not'}</span>;
    };

    let renderCount = 0;

    const Provider = ({ children }: { children: ReactNode }) => {
      const value = useMemo<WalletContextValue>(
        () => {
          renderCount++;
          return {
            isConnected: true,
            isConnecting: false,
            walletAddress: 'GB111...',
            walletType: 'Freighter',
            onConnect: () => {},
            onDisconnect: () => {},
          };
        },
        [],
      );

      return <WalletProvider value={value}>{children}</WalletProvider>;
    };

    render(
      <Provider>
        <WalletAddressConsumer />
        <ConnectionStatusConsumer />
      </Provider>,
    );

    expect(screen.getByTestId('address')).toHaveTextContent('GB111...');
    expect(screen.getByTestId('status')).toHaveTextContent('Connected');
  });
});
