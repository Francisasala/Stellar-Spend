import { getCurrencySymbol, formatFiatAmount } from '@/lib/format';

export interface RightPanelProps {
  isConnected: boolean;
  isConnecting: boolean;
  amount: string;
  quote: { destinationAmount: string; rate: number; currency: string } | null;
  isLoadingQuote: boolean;
  currency: string;
  onConnect: () => void;
}

export { getCurrencySymbol };

export function formatFiat(value: string | number, currency: string): string {
  return formatFiatAmount(value, currency);
}

export function formatRate(rate: number, currency: string): string {
  if (!rate) return '—';
  return `${formatFiat(rate, currency)} / USDC`;
}

export function formatNetworkFee(quote: RightPanelProps['quote']): string {
  if (!quote) return '—';
  return '2.50 USDC';
}
