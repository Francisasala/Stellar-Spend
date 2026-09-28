import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecipientStep } from '../RecipientStep';

const defaultProps = {
  currency: 'NGN',
  institution: '',
  currencies: [{ code: 'NGN', name: 'Nigerian Naira' }],
  institutions: [{ code: 'ACCESS', name: 'Access Bank' }],
  isCurrenciesLoading: false,
  isInstitutionsLoading: false,
  isVerifyingAccount: false,
  accountNumber: '',
  accountName: '',
  bankMode: 'local' as const,
  routingNumber: '',
  iban: '',
  touchedFields: {},
  isConnected: true,
  isSubmitting: false,
  onCurrencyChange: vi.fn(),
  onInstitutionChange: vi.fn(),
  onAccountNumberChange: vi.fn(),
  onBankModeChange: vi.fn(),
  onRoutingNumberChange: vi.fn(),
  onIbanChange: vi.fn(),
  onBlurCurrency: vi.fn(),
  onBlurInstitution: vi.fn(),
};

describe('RecipientStep', () => {
  it('renders currency and institution selects', () => {
    render(<RecipientStep {...defaultProps} />);
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bank/i)).toBeInTheDocument();
  });

  it('shows verify error when provided', () => {
    render(<RecipientStep {...defaultProps} verifyError="Invalid account" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid account');
  });

  it('disables institution select when no currency selected', () => {
    render(<RecipientStep {...defaultProps} currency="" institution="" />);
    expect(screen.getByLabelText(/bank/i)).toBeDisabled();
  });

  it('shows account name resolved field', () => {
    render(<RecipientStep {...defaultProps} accountName="John Doe" />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
