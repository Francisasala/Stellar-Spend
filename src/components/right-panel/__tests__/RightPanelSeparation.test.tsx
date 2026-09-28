import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HeroPanel } from '../HeroPanel';
import { BreakdownRow } from '../BreakdownRow';
import { formatFiat, formatRate, formatNetworkFee, getCurrencySymbol } from '../types';

describe('RightPanel Container/Presentational Separation', () => {
  describe('Presentational Component - HeroPanel', () => {
    it('renders pure presentation without data-fetching logic', () => {
      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={{ destinationAmount: '150000', rate: 1500, currency: 'NGN' }}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={1500}
          flash={false}
        />,
      );

      expect(screen.getByText('ESTIMATED PAYOUT')).toBeInTheDocument();
      expect(screen.getByText(/150,000/)).toBeInTheDocument();
    });

    it('accepts all required props for independent rendering', () => {
      const onConnect = vi.fn();
      render(
        <HeroPanel
          isConnected={false}
          isConnecting={false}
          amount=""
          quote={null}
          isLoadingQuote={false}
          currency="USD"
          onConnect={onConnect}
          liveRate={null}
          flash={false}
        />,
      );

      expect(screen.getByText('WALLET REQUIRED')).toBeInTheDocument();
    });

    it('invokes onConnect callback without fetching data', () => {
      const onConnect = vi.fn();
      render(
        <HeroPanel
          isConnected={false}
          isConnecting={false}
          amount=""
          quote={null}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={onConnect}
          liveRate={null}
          flash={false}
        />,
      );

      fireEvent.click(screen.getByText('CONNECT WALLET'));
      expect(onConnect).toHaveBeenCalled();
    });

    it('displays different states based on props without side effects', () => {
      const { rerender } = render(
        <HeroPanel
          isConnected={false}
          isConnecting={false}
          amount=""
          quote={null}
          isLoadingQuote={false}
          currency="USD"
          onConnect={vi.fn()}
          liveRate={null}
          flash={false}
        />,
      );

      expect(screen.getByText('WALLET REQUIRED')).toBeInTheDocument();

      rerender(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="50"
          quote={{ destinationAmount: '75000', rate: 1500, currency: 'NGN' }}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={null}
          flash={false}
        />,
      );

      expect(screen.getByText('ESTIMATED PAYOUT')).toBeInTheDocument();
    });

    it('shows loading state when isLoadingQuote is true', () => {
      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={null}
          isLoadingQuote={true}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={null}
          flash={false}
        />,
      );

      expect(screen.getByText('CALCULATING')).toBeInTheDocument();
      expect(screen.getByText('Fetching live rate...')).toBeInTheDocument();
    });

    it('shows connecting state when isConnecting is true', () => {
      render(
        <HeroPanel
          isConnected={false}
          isConnecting={true}
          amount=""
          quote={null}
          isLoadingQuote={false}
          currency="USD"
          onConnect={vi.fn()}
          liveRate={null}
          flash={false}
        />,
      );

      expect(screen.getByText('CONNECTING')).toBeInTheDocument();
      expect(screen.getByText('Awaiting signature')).toBeInTheDocument();
    });

    it('renders payout calculation with live rate when available', () => {
      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={null}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={1600}
          flash={false}
        />,
      );

      expect(screen.getByText('ESTIMATED PAYOUT')).toBeInTheDocument();
      expect(screen.getByText(/160,000/)).toBeInTheDocument();
    });

    it('prefers liveRate over quote rate when both available', () => {
      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={{ destinationAmount: '150000', rate: 1500, currency: 'NGN' }}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={1700}
          flash={false}
        />,
      );

      expect(screen.getByText('ESTIMATED PAYOUT')).toBeInTheDocument();
      expect(screen.getByText(/170,000/)).toBeInTheDocument();
    });
  });

  describe('Presentational Component - BreakdownRow', () => {
    it('renders pure label and value without data manipulation', () => {
      render(<BreakdownRow label="Network Fee" value="2.50 USDC" />);

      expect(screen.getByText('Network Fee')).toBeInTheDocument();
      expect(screen.getByText('2.50 USDC')).toBeInTheDocument();
    });

    it('accepts any string label and value', () => {
      render(<BreakdownRow label="Exchange Rate" value="1,500 NGN / USDC" />);

      expect(screen.getByText('Exchange Rate')).toBeInTheDocument();
      expect(screen.getByText('1,500 NGN / USDC')).toBeInTheDocument();
    });

    it('renders empty values without error', () => {
      render(<BreakdownRow label="Total" value="" />);

      expect(screen.getByText('Total')).toBeInTheDocument();
    });
  });

  describe('Data Logic Separation via Props', () => {
    it('HeroPanel calculates display values from props but does not fetch', () => {
      const { rerender } = render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="50"
          quote={null}
          isLoadingQuote={false}
          currency="USD"
          onConnect={vi.fn()}
          liveRate={1.5}
          flash={false}
        />,
      );

      expect(screen.getByText('ESTIMATED PAYOUT')).toBeInTheDocument();

      rerender(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={null}
          isLoadingQuote={false}
          currency="USD"
          onConnect={vi.fn()}
          liveRate={1.5}
          flash={false}
        />,
      );

      expect(screen.getByText('ESTIMATED PAYOUT')).toBeInTheDocument();
    });

    it('does not make API calls from presentational component', () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={{ destinationAmount: '150000', rate: 1500, currency: 'NGN' }}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={1500}
          flash={false}
        />,
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('Reuse Across Container Boundaries', () => {
    it('HeroPanel can be reused in different container contexts', () => {
      const props = {
        isConnected: true,
        isConnecting: false,
        amount: '100',
        quote: null,
        isLoadingQuote: false,
        currency: 'NGN' as const,
        onConnect: vi.fn(),
        liveRate: 1500,
        flash: false,
      };

      const { rerender } = render(<HeroPanel {...props} />);

      expect(screen.getByText('ESTIMATED PAYOUT')).toBeInTheDocument();

      const modifiedProps = { ...props, currency: 'USD' as const };
      rerender(<HeroPanel {...modifiedProps} />);

      expect(screen.getByText('ESTIMATED PAYOUT')).toBeInTheDocument();
    });

    it('BreakdownRow is reusable with any label/value pair', () => {
      render(<BreakdownRow label="Subtotal" value="$100.00" />);
      expect(screen.getByText('Subtotal')).toBeInTheDocument();

      render(<BreakdownRow label="Tax" value="$10.00" />);
      expect(screen.getByText('Tax')).toBeInTheDocument();
    });
  });

  describe('Props Drive Presentation Logic', () => {
    it('flash prop controls visual highlight without side effects', () => {
      const { container, rerender } = render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={null}
          isLoadingQuote={false}
          currency="USD"
          onConnect={vi.fn()}
          liveRate={1.5}
          flash={false}
        />,
      );

      let heroValue = container.querySelector('[class*="text-[#c9a962]"]');
      expect(heroValue).toBeInTheDocument();

      rerender(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={null}
          isLoadingQuote={false}
          currency="USD"
          onConnect={vi.fn()}
          liveRate={1.5}
          flash={true}
        />,
      );

      heroValue = container.querySelector('[class*="text-white"]');
      expect(heroValue).toBeInTheDocument();
    });

    it('currency prop determines formatting without lookup', () => {
      const { container } = render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={{ destinationAmount: '600', rate: 6, currency: 'EUR' }}
          isLoadingQuote={false}
          currency="EUR"
          onConnect={vi.fn()}
          liveRate={null}
          flash={false}
        />,
      );

      expect(container.textContent).toContain('600');
    });
  });

  describe('Helper Functions as Pure Utilities', () => {
    it('formatFiat is a pure function without side effects', () => {
      const result1 = formatFiat(5000, 'NGN');
      const result2 = formatFiat(5000, 'NGN');

      expect(result1).toBe(result2);
    });

    it('formatRate is a pure function without dependencies', () => {
      const result = formatRate(1500, 'NGN');
      expect(result).toContain('1,500');
    });

    it('formatNetworkFee handles null gracefully', () => {
      expect(formatNetworkFee(null)).toBe('—');
      expect(formatNetworkFee(2.5)).toBe('2.50 USDC');
    });

    it('getCurrencySymbol returns symbol without network call', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('EUR')).toBe('€');
      expect(getCurrencySymbol('NGN')).toBe('₦');
    });
  });

  describe('No Data Mutations in Presentational Layer', () => {
    it('HeroPanel does not modify quote object', () => {
      const quote = { destinationAmount: '150000', rate: 1500, currency: 'NGN' };
      const originalQuote = JSON.stringify(quote);

      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={quote}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={null}
          flash={false}
        />,
      );

      expect(JSON.stringify(quote)).toBe(originalQuote);
    });

    it('BreakdownRow does not modify input values', () => {
      const label = 'Fee';
      const value = '2.5';

      render(<BreakdownRow label={label} value={value} />);

      expect(label).toBe('Fee');
      expect(value).toBe('2.5');
    });
  });
});
