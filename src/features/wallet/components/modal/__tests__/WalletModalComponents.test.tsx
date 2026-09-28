import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WalletOptionButton } from '../modal/WalletOptionButton';
import { WalletModalHeader } from '../modal/WalletModalHeader';
import { WalletModalError } from '../modal/WalletModalError';

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
});
