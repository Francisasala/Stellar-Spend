import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeroPanel } from '../HeroPanel';
import { BreakdownRow } from '../BreakdownRow';
import { formatFiat, formatRate, formatNetworkFee, getCurrencySymbol } from '../types';

describe('RightPanel Subcomponents', () => {
  describe('HeroPanel', () => {
    it('prompts user to connect wallet when disconnected', () => {
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

      expect(screen.getByText('WALLET REQUIRED')).toBeInTheDocument();
      fireEvent.click(screen.getByText('CONNECT WALLET'));
      expect(onConnect).toHaveBeenCalled();
    });

    it('shows estimated payout when connected and has quote', () => {
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

    it('does not render a payout preview for a zero amount', () => {
      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="0"
          quote={{ destinationAmount: '150000', rate: 1500, currency: 'NGN' }}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={1500}
          flash={false}
        />,
      );

      expect(screen.getByText('READY TO PAYOUT')).toBeInTheDocument();
      expect(screen.getByText('Enter amount')).toBeInTheDocument();
      expect(screen.queryByText('ESTIMATED PAYOUT')).not.toBeInTheDocument();
    });

    it('does not render a payout preview for a negative amount', () => {
      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="-25"
          quote={{ destinationAmount: '150000', rate: 1500, currency: 'NGN' }}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={1500}
          flash={false}
        />,
      );

      expect(screen.getByText('READY TO PAYOUT')).toBeInTheDocument();
      expect(screen.getByText('Enter amount')).toBeInTheDocument();
    });

    it('renders very large live-rate conversions with grouped digits', () => {
      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="123456789.987"
          quote={null}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={1600}
          flash={false}
        />,
      );

      expect(screen.getByText('ESTIMATED PAYOUT')).toBeInTheDocument();
      expect(screen.getByText(/197,530,863,979/)).toBeInTheDocument();
      expect(screen.getByText(/1,600.*USDC/)).toBeInTheDocument();
    });

    it('renders very small live-rate conversions without dropping the preview state', () => {
      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="0.000001"
          quote={null}
          isLoadingQuote={false}
          currency="USD"
          onConnect={vi.fn()}
          liveRate={1.23}
          flash={false}
        />,
      );

      expect(screen.getByText('ESTIMATED PAYOUT')).toBeInTheDocument();
      expect(screen.getByText('$0.00')).toBeInTheDocument();
      expect(screen.getByText('$1.23 / USDC')).toBeInTheDocument();
    });

    it('falls back to quote rate when a live exchange rate is unavailable', () => {
      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={{ destinationAmount: '150000', rate: 1500, currency: 'NGN' }}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={null}
          flash={false}
        />,
      );

      expect(screen.getByText('ESTIMATED PAYOUT')).toBeInTheDocument();
      expect(screen.getByText(/150,000/)).toBeInTheDocument();
      expect(screen.getByText(/1,500.*USDC/)).toBeInTheDocument();
    });

    it('shows the ready state when both quote and live exchange rate are missing', () => {
      render(
        <HeroPanel
          isConnected={true}
          isConnecting={false}
          amount="100"
          quote={null}
          isLoadingQuote={false}
          currency="NGN"
          onConnect={vi.fn()}
          liveRate={null}
          flash={false}
        />,
      );

      expect(screen.getByText('READY TO PAYOUT')).toBeInTheDocument();
      expect(screen.getByText('Enter amount')).toBeInTheDocument();
      expect(screen.queryByText('ESTIMATED PAYOUT')).not.toBeInTheDocument();
    });
  });

  describe('BreakdownRow', () => {
    it('renders label and value', () => {
      render(<BreakdownRow label="Network Fee" value="2.50 USDC" />);
      expect(screen.getByText('Network Fee')).toBeInTheDocument();
      expect(screen.getByText('2.50 USDC')).toBeInTheDocument();
    });
  });

  describe('helpers', () => {
    it('formats fiat and rate accurately', () => {
      expect(formatFiat(5000, 'NGN')).toContain('5,000');
      expect(formatRate(1500, 'NGN')).toContain('1,500');
      expect(formatNetworkFee(null)).toBe('—');
      expect(getCurrencySymbol('EUR')).toBe('€');
    });
  });
});

describe('RightPanel currency formatting edge cases', () => {
  it('formats zero, negative, large, and tiny fiat values', () => {
    expect(formatFiat(0, 'NGN')).toContain('0');
    expect(formatFiat(-1234.56, 'USD')).toBe('-$1,234.56');
    expect(formatFiat(9876543210, 'NGN')).toContain('9,876,543,210');
    expect(formatFiat(0.004, 'USD')).toBe('$0.00');
  });

  it('falls back when a rate is missing or unsupported currency formatting is requested', () => {
    expect(formatRate(0, 'NGN')).not.toContain('USDC');
    expect(formatFiat(42, 'XYZ')).toBe('XYZ 42.00');
  });
});
