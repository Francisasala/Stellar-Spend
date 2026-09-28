import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmStep } from '../ConfirmStep';

const defaultProps = {
  quote: null,
  currency: 'NGN',
  liveRate: 1600,
  rateFlash: false,
  amount: '100',
  ctaState: 'ready' as const,
  ctaDisabled: false,
  isConnected: true,
  isSubmitting: false,
  onToggleInsurance: vi.fn(),
  onSubmit: vi.fn(),
  onConnect: vi.fn(),
};

describe('ConfirmStep', () => {
  it('renders the submit button', () => {
    render(<ConfirmStep {...defaultProps} />);
    // The CTA button should be visible (label from getCtaLabel('ready'))
    expect(screen.getByRole('button', { name: /initiate offramp/i })).toBeInTheDocument();
  });

  it('calls onSubmit when CTA is clicked in ready state', async () => {
    const onSubmit = vi.fn();
    render(<ConfirmStep {...defaultProps} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('calls onConnect when CTA is clicked in disconnected state', async () => {
    const onConnect = vi.fn();
    render(
      <ConfirmStep
        {...defaultProps}
        ctaState="disconnected"
        onConnect={onConnect}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('disables CTA when ctaDisabled is true', () => {
    render(<ConfirmStep {...defaultProps} ctaDisabled={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows connect wallet label when disconnected', () => {
    render(<ConfirmStep {...defaultProps} ctaState="disconnected" />);
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });
});
