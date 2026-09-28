import type { BankMode } from '@/components/BankAccountInput';
import type { InsuranceQuote } from '@/components/InsuranceOption';
import type { ProviderQuote } from '@/components/QuoteComparison';
import type { QuoteResult as QuoteFetcherResult } from '@/lib/offramp';
import { formatFiatAmount } from '@/lib/format';

export type FeeMethod = 'USDC' | 'XLM';

export type QuoteResult = QuoteFetcherResult;

export interface Currency {
  code: string;
  name: string;
}

export interface Institution {
  code: string;
  name: string;
}

export interface GasFeeOptions {
  usdcFee: string;
  xlmFee: string;
}

export interface OfframpPayload {
  amount: string;
  currency: string;
  institution: string;
  accountIdentifier: string;
  accountName: string;
  feeMethod: FeeMethod;
  bankMode: BankMode;
  routingNumber?: string;
  iban?: string;
  quote: QuoteResult | null;
  insurance: {
    enabled: boolean;
    quote: InsuranceQuote | null;
  };
}

export interface FormCardProps {
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onSubmit: (payload: OfframpPayload) => void;
  resetKey?: number;
  onQuoteChange?: (quote: QuoteResult | null) => void;
  onAmountChange?: (v: string) => void;
  onCurrencyChange?: (v: string) => void;
  isInitialLoading?: boolean;
}

export { CURRENCY_SYMBOLS, getCurrencySymbol } from '@/lib/format';

export function formatPayout(amount: string, currency: string): string {
  return formatFiatAmount(amount, currency);
}

export function buildProviderQuotes(quote: QuoteResult, currency: string): ProviderQuote[] {
  const base = parseFloat(quote.destinationAmount);
  const baseRate = quote.rate;
  const baseFee = parseFloat(quote.bridgeFee ?? '0.5');

  return [
    {
      id: 'paycrest',
      provider: 'Paycrest',
      rate: baseRate,
      bridgeFee: baseFee.toFixed(2),
      payoutFee: '0.00',
      totalFee: baseFee.toFixed(2),
      estimatedTime: 300,
      destinationAmount: base.toFixed(2),
      currency,
      rating: 5,
      badge: 'Best Rate',
    },
    {
      id: 'yellowcard',
      provider: 'Yellow Card',
      rate: Math.round(baseRate * 0.992),
      bridgeFee: (baseFee + 0.3).toFixed(2),
      payoutFee: '0.50',
      totalFee: (baseFee + 0.8).toFixed(2),
      estimatedTime: 180,
      destinationAmount: (base * 0.992).toFixed(2),
      currency,
      rating: 4,
      badge: 'Fastest',
    },
    {
      id: 'kotani',
      provider: 'Kotani Pay',
      rate: Math.round(baseRate * 0.985),
      bridgeFee: (baseFee + 0.1).toFixed(2),
      payoutFee: '0.20',
      totalFee: (baseFee + 0.3).toFixed(2),
      estimatedTime: 420,
      destinationAmount: (base * 0.985).toFixed(2),
      currency,
      rating: 4,
      badge: 'Lowest Fee',
    },
  ];
}

export type CtaState = 'disconnected' | 'connecting' | 'ready' | 'submitting';

export function getCtaLabel(state: CtaState): string {
  switch (state) {
    case 'disconnected':
      return 'CONNECT WALLET';
    case 'connecting':
      return 'WAITING FOR SIGNATURE...';
    case 'submitting':
      return 'INITIATING OFFRAMP...';
    default:
      return 'INITIATE OFFRAMP →';
  }
}
