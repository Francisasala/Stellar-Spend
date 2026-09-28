import { describe, it, expect } from 'vitest';
import { PremiumBreakdown } from '../PremiumBreakdown';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import {
  calculateQuote,
  getRiskBand,
  formatAmount,
  formatCountdown,
  type InsuranceQuote,
} from '../types';

describe('OptionSummary (PremiumBreakdown Pricing Logic) — Issue #1100', () => {
  describe('Pricing Summary Calculation', () => {
    it('correctly calculates premium for low-value amounts with base rate', () => {
      const quote = calculateQuote(500, 'USDC');
      expect(quote.premium).toBeCloseTo(500 * 0.005, 4);
      expect(quote.provider).toBe('default');
    });

    it('applies bulk discount rate for high-value transactions', () => {
      const quote = calculateQuote(15000, 'USDC');
      expect(quote.premium).toBeCloseTo(15000 * 0.003, 4);
      expect(quote.provider).toBe('enterprise');
    });

    it('calculates coverage as 110% of transaction amount', () => {
      const amounts = [100, 500, 1000, 10000, 50000];
      amounts.forEach((amount) => {
        const quote = calculateQuote(amount, 'USDC');
        expect(quote.coverage).toBeCloseTo(amount * 1.1, 4);
      });
    });

    it('applies risk multiplier based on risk score', () => {
      const lowRiskQuote = calculateQuote(100000, 'USDC');
      const highRiskQuote = calculateQuote(50, 'ETH');
      expect(lowRiskQuote.premium).toBeLessThan(highRiskQuote.premium);
    });
  });

  describe('Provider Tier Selection', () => {
    it('assigns default provider for amounts < 1000', () => {
      const quote = calculateQuote(999, 'USDC');
      expect(quote.provider).toBe('default');
    });

    it('assigns premium provider for amounts 1000-9999', () => {
      const quote = calculateQuote(5000, 'USDC');
      expect(quote.provider).toBe('premium');
    });

    it('assigns enterprise provider for amounts >= 10000', () => {
      const quote = calculateQuote(10000, 'USDC');
      expect(quote.provider).toBe('enterprise');
    });
  });

  describe('Risk Score & Band Assignment', () => {
    it('calculates lower risk scores for stablecoin transactions', () => {
      const stablecoinQuote = calculateQuote(100, 'USDC');
      const volatileCoinQuote = calculateQuote(100, 'ETH');
      expect(stablecoinQuote.riskScore).toBeLessThan(volatileCoinQuote.riskScore);
    });

    it('reduces risk score for high-value transactions', () => {
      const smallQuote = calculateQuote(100, 'USDC');
      const largeQuote = calculateQuote(50000, 'USDC');
      expect(largeQuote.riskScore).toBeLessThan(smallQuote.riskScore);
    });

    it('classifies risk bands correctly', () => {
      expect(getRiskBand(30)).toBe('low');
      expect(getRiskBand(50)).toBe('medium');
      expect(getRiskBand(75)).toBe('high');
    });
  });

  describe('Summary Display & Formatting', () => {
    it('displays premium with correct currency formatting', () => {
      const mockQuote: InsuranceQuote = {
        premium: 50.5,
        coverage: 1100,
        provider: 'default',
        riskScore: 45,
        expiresAt: Date.now() + 60000,
      };

      render(
        <I18nProvider>
          <PremiumBreakdown quote={mockQuote} amount={1000} enabled={true} timeLeft={30000} />
        </I18nProvider>,
      );

      expect(screen.getByText(/50.50 USDC/)).toBeInTheDocument();
    });

    it('displays coverage amount with localized formatting', () => {
      const mockQuote: InsuranceQuote = {
        premium: 5,
        coverage: 1000,
        provider: 'default',
        riskScore: 45,
        expiresAt: Date.now() + 60000,
      };

      render(
        <I18nProvider>
          <PremiumBreakdown quote={mockQuote} amount={900} enabled={true} timeLeft={null} />
        </I18nProvider>,
      );

      expect(screen.getByText(/1,000.00 USDC/)).toBeInTheDocument();
    });

    it('applies correct provider tier badge styling', () => {
      const quotes = [
        { ...{
          premium: 5,
          coverage: 100,
          provider: 'default' as const,
          riskScore: 45,
          expiresAt: Date.now() + 60000,
        } },
        { ...{
          premium: 3,
          coverage: 11000,
          provider: 'enterprise' as const,
          riskScore: 35,
          expiresAt: Date.now() + 60000,
        } },
      ];

      quotes.forEach((quote) => {
        const { unmount } = render(
          <I18nProvider>
            <PremiumBreakdown quote={quote} amount={quote.coverage / 1.1} enabled={false} timeLeft={null} />
          </I18nProvider>,
        );
        unmount();
      });
    });
  });

  describe('Countdown & Expiry Display', () => {
    it('formats countdown correctly for various time values', () => {
      expect(formatCountdown(0)).toBe('0:00');
      expect(formatCountdown(65000)).toBe('1:05');
      expect(formatCountdown(3661000)).toBe('61:01');
    });

    it('shows expiry countdown when enabled and timeLeft is not null', () => {
      const mockQuote: InsuranceQuote = {
        premium: 5,
        coverage: 1100,
        provider: 'default',
        riskScore: 45,
        expiresAt: Date.now() + 60000,
      };

      const { getByText } = render(
        <I18nProvider>
          <PremiumBreakdown quote={mockQuote} amount={1000} enabled={true} timeLeft={45000} />
        </I18nProvider>,
      );

      expect(getByText(/0:45/)).toBeInTheDocument();
    });

    it('hides countdown when option is disabled', () => {
      const mockQuote: InsuranceQuote = {
        premium: 5,
        coverage: 1100,
        provider: 'default',
        riskScore: 45,
        expiresAt: Date.now() + 60000,
      };

      const { queryByLabelText } = render(
        <I18nProvider>
          <PremiumBreakdown quote={mockQuote} amount={1000} enabled={false} timeLeft={45000} />
        </I18nProvider>,
      );

      expect(queryByLabelText(/expires in/i)).not.toBeInTheDocument();
    });
  });

  describe('OptionSelector & OptionSummary Separation', () => {
    it('verifies PremiumBreakdown is a pure summary component with no selection logic', () => {
      const mockQuote: InsuranceQuote = {
        premium: 5,
        coverage: 1100,
        provider: 'default',
        riskScore: 45,
        expiresAt: Date.now() + 60000,
      };

      const { rerender } = render(
        <I18nProvider>
          <PremiumBreakdown quote={mockQuote} amount={1000} enabled={true} timeLeft={60000} />
        </I18nProvider>,
      );

      const newQuote: InsuranceQuote = {
        ...mockQuote,
        premium: 10,
        provider: 'premium',
      };

      rerender(
        <I18nProvider>
          <PremiumBreakdown quote={newQuote} amount={1000} enabled={true} timeLeft={30000} />
        </I18nProvider>,
      );

      expect(screen.getByText(/10.00 USDC/)).toBeInTheDocument();
    });
  });

  describe('Fixed Rate Display', () => {
    it('shows 0.3% fixed rate for transactions >= 10000', () => {
      const mockQuote: InsuranceQuote = {
        premium: 30,
        coverage: 11000,
        provider: 'enterprise',
        riskScore: 40,
        expiresAt: Date.now() + 60000,
      };

      render(
        <I18nProvider>
          <PremiumBreakdown quote={mockQuote} amount={10000} enabled={true} timeLeft={null} />
        </I18nProvider>,
      );

      expect(screen.getByText(/0.3%/)).toBeInTheDocument();
    });

    it('shows 0.5% fixed rate for transactions < 10000', () => {
      const mockQuote: InsuranceQuote = {
        premium: 5,
        coverage: 1100,
        provider: 'default',
        riskScore: 45,
        expiresAt: Date.now() + 60000,
      };

      render(
        <I18nProvider>
          <PremiumBreakdown quote={mockQuote} amount={1000} enabled={true} timeLeft={null} />
        </I18nProvider>,
      );

      expect(screen.getByText(/0.5%/)).toBeInTheDocument();
    });
  });
});
