import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletProvider, useWalletContext } from '../WalletContext';

function TestConsumer() {
  const { isConnected, isConnecting, onConnect } = useWalletContext();
  return (
    <div>
      <span data-testid="connected">{String(isConnected)}</span>
      <span data-testid="connecting">{String(isConnecting)}</span>
      <button onClick={onConnect}>Connect</button>
    </div>
  );
}

describe('WalletContext', () => {
  it('provides wallet state to consumers', () => {
    const value = {
      isConnected: true,
      isConnecting: false,
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
    };
    render(
      <WalletProvider value={value}>
        <TestConsumer />
      </WalletProvider>,
    );
    expect(screen.getByTestId('connected')).toHaveTextContent('true');
    expect(screen.getByTestId('connecting')).toHaveTextContent('false');
  });

  it('calls onConnect when button is clicked', async () => {
    const onConnect = vi.fn();
    const value = {
      isConnected: false,
      isConnecting: false,
      onConnect,
      onDisconnect: vi.fn(),
    };
    render(
      <WalletProvider value={value}>
        <TestConsumer />
      </WalletProvider>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('throws when used outside WalletProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useWalletContext must be used within a <WalletProvider>',
    );
    spy.mockRestore();
  });

  it('exposes walletAddress and walletType when provided', () => {
    function FullConsumer() {
      const { walletAddress, walletType } = useWalletContext();
      return (
        <div>
          <span data-testid="address">{walletAddress ?? 'none'}</span>
          <span data-testid="type">{walletType ?? 'none'}</span>
        </div>
      );
    }
    const value = {
      isConnected: true,
      isConnecting: false,
      walletAddress: 'GBBD47...',
      walletType: 'Freighter' as const,
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
    };
    render(
      <WalletProvider value={value}>
        <FullConsumer />
      </WalletProvider>,
    );
    expect(screen.getByTestId('address')).toHaveTextContent('GBBD47...');
    expect(screen.getByTestId('type')).toHaveTextContent('Freighter');
  });
});
