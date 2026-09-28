import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AmountStep } from '../AmountStep';

const defaultProps = {
  amount: '',
  feeMethod: 'USDC' as const,
  gasFees: null,
  isGasFeesLoading: false,
  isQuoteLoading: false,
  touchedFields: {},
  isConnected: true,
  isSubmitting: false,
  onAmountChange: vi.fn(),
  onFeeMethodChange: vi.fn(),
  onBlurAmount: vi.fn(),
};

describe('AmountStep', () => {
  it('renders the amount input', () => {
    render(<AmountStep {...defaultProps} />);
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  it('shows amount error when provided', () => {
    render(<AmountStep {...defaultProps} amountError="Amount is required" />);
    expect(screen.getByText('Amount is required')).toBeInTheDocument();
  });

  it('disables input when not connected', () => {
    render(<AmountStep {...defaultProps} isConnected={false} />);
    expect(screen.getByLabelText(/amount/i)).toBeDisabled();
  });

  it('calls onAmountChange on input', async () => {
    const onAmountChange = vi.fn();
    render(<AmountStep {...defaultProps} onAmountChange={onAmountChange} />);
    await userEvent.type(screen.getByLabelText(/amount/i), '10');
    expect(onAmountChange).toHaveBeenCalled();
  });

  it('shows loading suffix when quote is loading', () => {
    render(<AmountStep {...defaultProps} isQuoteLoading={true} />);
    // The suffix '...' should be visible in the input area
    expect(screen.getByText('...')).toBeInTheDocument();
  });
});
