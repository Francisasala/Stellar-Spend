import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WalletOptionButton } from '../WalletOptionButton';
import { WalletModalHeader } from '../WalletModalHeader';
import { WalletModalError } from '../WalletModalError';
import type { WalletOption } from '../types';

describe('WalletModal Subcomponents - Extended', () => {
  describe('WalletOptionButton - Focused Single Responsibility', () => {
    const mockWallet: WalletOption = {
      type: 'freighter' as const,
      name: 'Freighter',
      description: 'Stellar browser extension',
      installUrl: 'https://freighter.app',
      icon: <span data-testid="wallet-icon">F</span>,
    };

    it('renders wallet option button with all info', () => {
      render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={false}
          connectingWallet={null}
          onConnect={vi.fn()}
        />,
      );

      expect(screen.getByText('Freighter')).toBeInTheDocument();
      expect(screen.getByText('Stellar browser extension')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-icon')).toBeInTheDocument();
    });

    it('triggers onConnect with wallet type on click', () => {
      const onConnect = vi.fn();
      render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={false}
          connectingWallet={null}
          onConnect={onConnect}
        />,
      );

      fireEvent.click(screen.getByText('Freighter'));
      expect(onConnect).toHaveBeenCalledWith('freighter');
    });

    it('should be disabled when any wallet is connecting', () => {
      render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={true}
          connectingWallet={'lobstr' as const}
          onConnect={vi.fn()}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should show connecting state for this wallet', () => {
      render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={true}
          connectingWallet={'freighter' as const}
          onConnect={vi.fn()}
        />,
      );

      expect(screen.getByText('Connecting…')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('should show dimmed state for other wallets during connection', () => {
      render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={true}
          connectingWallet={'lobstr' as const}
          onConnect={vi.fn()}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-40');
    });

    it('should not show chevron icon when connecting', () => {
      const { container } = render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={true}
          connectingWallet={'freighter' as const}
          onConnect={vi.fn()}
        />,
      );

      const chevrons = container.querySelectorAll('[class*="chevron"]');
      expect(chevrons.length).toBe(0);
    });

    it('should show chevron icon when not connecting', () => {
      const { container } = render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={false}
          connectingWallet={null}
          onConnect={vi.fn()}
        />,
      );

      const chevrons = container.querySelectorAll('[class*="chevron"]');
      expect(chevrons.length).toBeGreaterThan(0);
    });

    it('should have accessible label for wallet connection', () => {
      render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={false}
          connectingWallet={null}
          onConnect={vi.fn()}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Connect with Freighter');
    });

    it('should have test id for wallet type', () => {
      render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={false}
          connectingWallet={null}
          onConnect={vi.fn()}
        />,
      );

      const button = screen.getByTestId('wallet-option-freighter');
      expect(button).toBeInTheDocument();
    });
  });

  describe('WalletModalHeader - Focused Header Component', () => {
    it('renders modal header with title', () => {
      render(<WalletModalHeader isConnecting={false} onClose={vi.fn()} />);

      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });

    it('triggers onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<WalletModalHeader isConnecting={false} onClose={onClose} />);

      const closeButton = screen.getByLabelText(/close wallet modal/i);
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should disable close button when connecting', () => {
      const onClose = vi.fn();
      render(<WalletModalHeader isConnecting={true} onClose={onClose} />);

      const closeButton = screen.getByLabelText(/close wallet modal/i);
      expect(closeButton).toBeDisabled();
    });

    it('should allow closing when not connecting', () => {
      const onClose = vi.fn();
      render(<WalletModalHeader isConnecting={false} onClose={onClose} />);

      const closeButton = screen.getByLabelText(/close wallet modal/i);
      expect(closeButton).not.toBeDisabled();

      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('WalletModalError - Focused Error Component', () => {
    it('renders error message', () => {
      const errorMsg = 'User rejected connection request';
      render(<WalletModalError error={errorMsg} onDismiss={vi.fn()} />);

      expect(screen.getByText(errorMsg)).toBeInTheDocument();
    });

    it('triggers onDismiss when dismiss button is clicked', () => {
      const onDismiss = vi.fn();
      render(<WalletModalError error="Connection failed" onDismiss={onDismiss} />);

      const dismissButton = screen.getByLabelText(/dismiss error/i);
      fireEvent.click(dismissButton);

      expect(onDismiss).toHaveBeenCalled();
    });

    it('should display specific error messages correctly', () => {
      const errors = [
        'User rejected connection request',
        'Wallet extension not found',
        'Network error occurred',
      ];

      for (const error of errors) {
        const { unmount } = render(<WalletModalError error={error} onDismiss={vi.fn()} />);
        expect(screen.getByText(error)).toBeInTheDocument();
        unmount();
      }
    });

    it('should have accessible error alert role', () => {
      render(<WalletModalError error="Connection error" onDismiss={vi.fn()} />);

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toBeInTheDocument();
    });
  });

  describe('WalletModal Subcomponents - Integration', () => {
    it('should render list of wallet options without modal header', () => {
      const onConnect = vi.fn();
      const wallets: WalletOption[] = [
        {
          type: 'freighter' as const,
          name: 'Freighter',
          description: 'Browser extension',
          icon: <span>F</span>,
          installUrl: 'https://freighter.app',
        },
        {
          type: 'lobstr' as const,
          name: 'Lobstr',
          description: 'Mobile wallet',
          icon: <span>L</span>,
          installUrl: 'https://lobstr.co',
        },
      ];

      render(
        <>
          {wallets.map((wallet) => (
            <WalletOptionButton
              key={wallet.type}
              wallet={wallet}
              isConnecting={false}
              connectingWallet={null}
              onConnect={onConnect}
            />
          ))}
        </>,
      );

      expect(screen.getByText('Freighter')).toBeInTheDocument();
      expect(screen.getByText('Lobstr')).toBeInTheDocument();
    });

    it('should handle header and error display together', () => {
      const onClose = vi.fn();
      const onDismiss = vi.fn();

      render(
        <>
          <WalletModalHeader isConnecting={false} onClose={onClose} />
          <WalletModalError error="Connection failed" onDismiss={onDismiss} />
        </>,
      );

      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
      expect(screen.getByText('Connection failed')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText(/close wallet modal/i));
      expect(onClose).toHaveBeenCalled();

      fireEvent.click(screen.getByLabelText(/dismiss error/i));
      expect(onDismiss).toHaveBeenCalled();
    });

    it('should handle connection state transitions across components', () => {
      const onConnect = vi.fn();
      const { rerender } = render(
        <>
          <WalletModalHeader isConnecting={false} onClose={vi.fn()} />
          <WalletOptionButton
            wallet={{
              type: 'freighter' as const,
              name: 'Freighter',
              description: 'Browser extension',
              icon: <span>F</span>,
              installUrl: 'https://freighter.app',
            }}
            isConnecting={false}
            connectingWallet={null}
            onConnect={onConnect}
          />
        </>,
      );

      fireEvent.click(screen.getByText('Freighter'));
      expect(onConnect).toHaveBeenCalled();

      rerender(
        <>
          <WalletModalHeader isConnecting={true} onClose={vi.fn()} />
          <WalletOptionButton
            wallet={{
              type: 'freighter' as const,
              name: 'Freighter',
              description: 'Browser extension',
              icon: <span>F</span>,
              installUrl: 'https://freighter.app',
            }}
            isConnecting={true}
            connectingWallet={'freighter' as const}
            onConnect={onConnect}
          />
        </>,
      );

      expect(screen.getByText('Connecting…')).toBeInTheDocument();
      const closeBtn = screen.getByLabelText(/close wallet modal/i);
      expect(closeBtn).toBeDisabled();
    });
  });

  describe('WalletModal Subcomponents - Accessibility', () => {
    it('should have proper ARIA attributes for button states', () => {
      const { rerender } = render(
        <WalletOptionButton
          wallet={{
            type: 'freighter' as const,
            name: 'Freighter',
            description: 'Browser extension',
            icon: <span>F</span>,
            installUrl: 'https://freighter.app',
          }}
          isConnecting={false}
          connectingWallet={null}
          onConnect={vi.fn()}
        />,
      );

      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Connect with Freighter');
      expect(button).toHaveAttribute('aria-busy', 'false');

      rerender(
        <WalletOptionButton
          wallet={{
            type: 'freighter' as const,
            name: 'Freighter',
            description: 'Browser extension',
            icon: <span>F</span>,
            installUrl: 'https://freighter.app',
          }}
          isConnecting={true}
          connectingWallet={'freighter' as const}
          onConnect={vi.fn()}
        />,
      );

      button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('should provide descriptive text for screen readers', () => {
      render(
        <>
          <WalletModalHeader isConnecting={false} onClose={vi.fn()} />
          <WalletModalError error="User rejected" onDismiss={vi.fn()} />
        </>,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
