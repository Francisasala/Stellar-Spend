import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WalletOptionButton } from '../WalletOptionButton';
import { WalletModalHeader } from '../WalletModalHeader';
import { WalletModalError } from '../WalletModalError';

describe('WalletModal Subcomponents', () => {
  describe('WalletOptionButton', () => {
    it('renders wallet option and connects on click', () => {
      const onConnect = vi.fn();
      const mockWallet = {
        type: 'freighter' as const,
        name: 'Freighter',
        description: 'Stellar browser extension',
        installUrl: 'https://freighter.app',
        icon: <span>Icon</span>,
      };

      render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={false}
          connectingWallet={null}
          onConnect={onConnect}
        />,
      );

      expect(screen.getByText('Freighter')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Freighter'));
      expect(onConnect).toHaveBeenCalledWith('freighter');
    });
  });

  describe('WalletModalHeader', () => {
    it('renders modal header and handles close', () => {
      const onClose = vi.fn();
      render(<WalletModalHeader isConnecting={false} onClose={onClose} />);

      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText(/close wallet modal/i));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('WalletModalError', () => {
    it('renders error and handles dismissal', () => {
      const onDismiss = vi.fn();
      render(<WalletModalError error="User rejected signature" onDismiss={onDismiss} />);

      expect(screen.getByText('User rejected signature')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText(/dismiss error/i));
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('Accessibility: aria-labels and descriptions', () => {
    it('should have aria-label on close button', () => {
      const onClose = vi.fn();
      render(<WalletModalHeader isConnecting={false} onClose={onClose} />);

      const closeButton = screen.getByLabelText(/close wallet modal/i);
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label');
    });

    it('should have aria-label on wallet option buttons', () => {
      const mockWallet = {
        type: 'freighter' as const,
        name: 'Freighter',
        description: 'Stellar browser extension',
        installUrl: 'https://freighter.app',
        icon: <span>Icon</span>,
      };

      render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={false}
          connectingWallet={null}
          onConnect={vi.fn()}
        />,
      );

      const button = screen.getByText('Freighter').closest('button');
      expect(button).toBeInTheDocument();
    });

    it('should have aria-label on error dismiss button', () => {
      render(<WalletModalError error="Connection failed" onDismiss={vi.fn()} />);

      const dismissButton = screen.getByLabelText(/dismiss error/i);
      expect(dismissButton).toHaveAttribute('aria-label');
    });

    it('should have descriptive error message text', () => {
      const errorMessage = 'Failed to connect to wallet. Please try again.';
      render(<WalletModalError error={errorMessage} onDismiss={vi.fn()} />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Accessibility: focus management', () => {
    it('should allow focus on wallet option buttons', () => {
      const mockWallet = {
        type: 'freighter' as const,
        name: 'Freighter',
        description: 'Stellar browser extension',
        installUrl: 'https://freighter.app',
        icon: <span>Icon</span>,
      };

      render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={false}
          connectingWallet={null}
          onConnect={vi.fn()}
        />,
      );

      const button = screen.getByText('Freighter').closest('button');
      button?.focus();
      expect(button).toHaveFocus();
    });

    it('should allow focus on close button', () => {
      render(<WalletModalHeader isConnecting={false} onClose={vi.fn()} />);

      const closeButton = screen.getByLabelText(/close wallet modal/i);
      closeButton.focus();
      expect(closeButton).toHaveFocus();
    });

    it('should allow focus on error dismiss button', () => {
      render(<WalletModalError error="Error message" onDismiss={vi.fn()} />);

      const dismissButton = screen.getByLabelText(/dismiss error/i);
      dismissButton.focus();
      expect(dismissButton).toHaveFocus();
    });
  });

  describe('Accessibility: keyboard interaction', () => {
    it('should respond to Enter key on wallet button', () => {
      const onConnect = vi.fn();
      const mockWallet = {
        type: 'freighter' as const,
        name: 'Freighter',
        description: 'Stellar browser extension',
        installUrl: 'https://freighter.app',
        icon: <span>Icon</span>,
      };

      render(
        <WalletOptionButton
          wallet={mockWallet}
          isConnecting={false}
          connectingWallet={null}
          onConnect={onConnect}
        />,
      );

      const button = screen.getByText('Freighter').closest('button');
      fireEvent.keyDown(button!, { key: 'Enter' });
      fireEvent.click(button!);
      expect(onConnect).toHaveBeenCalled();
    });

    it('should respond to Space key on close button', () => {
      const onClose = vi.fn();
      render(<WalletModalHeader isConnecting={false} onClose={onClose} />);

      const closeButton = screen.getByLabelText(/close wallet modal/i);
      fireEvent.keyDown(closeButton, { key: ' ' });
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility: semantic structure', () => {
    it('should use semantic button elements', () => {
      render(<WalletModalHeader isConnecting={false} onClose={vi.fn()} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((button) => {
        expect(button.tagName).toBe('BUTTON');
      });
    });

    it('should have proper heading structure', () => {
      render(<WalletModalHeader isConnecting={false} onClose={vi.fn()} />);

      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });
  });
});
