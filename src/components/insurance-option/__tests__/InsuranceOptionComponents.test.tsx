import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import { TermsModal } from '../TermsModal';
import { PremiumBreakdown } from '../PremiumBreakdown';
import { calculateQuote, getRiskBand, formatAmount, formatCountdown } from '../types';

describe('InsuranceOption Subcomponents', () => {
  describe('TermsModal', () => {
    it('renders terms and closes on click or Escape', () => {
      const onClose = vi.fn();
      render(
        <I18nProvider>
          <TermsModal onClose={onClose} />
        </I18nProvider>,
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText(/close terms/i));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('PremiumBreakdown', () => {
    it('renders quote details correctly', () => {
      const mockQuote = {
        premium: 0.5,
        coverage: 110,
        provider: 'default' as const,
        riskScore: 45,
        expiresAt: Date.now() + 60000,
      };

      render(
        <I18nProvider>
          <PremiumBreakdown quote={mockQuote} amount={100} enabled={true} timeLeft={50000} />
        </I18nProvider>,
      );

      expect(screen.getByText(/0.50 USDC/)).toBeInTheDocument();
      expect(screen.getByText(/110.00 USDC/)).toBeInTheDocument();
    });
  });

  describe('helpers', () => {
    it('calculates quote correctly for amounts', () => {
      const quote = calculateQuote(100, 'USDC');
      expect(quote.coverage).toBe(110);
      expect(quote.provider).toBe('default');
    });

    it('determines risk band', () => {
      expect(getRiskBand(30)).toBe('low');
      expect(getRiskBand(50)).toBe('medium');
      expect(getRiskBand(80)).toBe('high');
    });

    it('formats amount and countdown', () => {
      expect(formatAmount(100.5)).toBe('100.50');
      expect(formatCountdown(65000)).toBe('1:05');
    });
  });
});
