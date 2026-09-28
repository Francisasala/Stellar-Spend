import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { QuoteResult, getCurrencySymbol, formatPayout } from './types';

export interface PayoutBoxProps {
  quote: QuoteResult;
  currency: string;
  liveRate?: number | null;
  flash?: boolean;
}

export function PayoutBox({
  quote,
  currency,
  liveRate,
  flash,
}: PayoutBoxProps) {
  const effectiveRate = liveRate ?? quote.rate;
  const amount = parseFloat(quote.destinationAmount);
  const liveDestination =
    liveRate && quote.rate > 0
      ? ((amount / quote.rate) * liveRate).toFixed(2)
      : quote.destinationAmount;

  return (
    <div className="border border-[#c9a962]/30 bg-[#c9a962]/5 px-4 py-3 flex items-center justify-between gap-4" data-testid="quote-result">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] tracking-[0.18em] text-[#777777] uppercase">
          Estimated Payout
        </span>
        <span className="text-[10px] text-[#777777]">
          Rate:{' '}
          {currency.toUpperCase() === 'NGN'
            ? `${getCurrencySymbol(currency)}${formatNumber(effectiveRate)}`
            : `${getCurrencySymbol(currency)} ${effectiveRate.toFixed(4)}`}{' '}
          / USDC
        </span>
      </div>
      <span
        className={cn(
          'font-bold text-lg tabular-nums transition-colors duration-300',
          flash ? 'text-white' : 'text-[#c9a962]',
        )}
      >
        {formatPayout(liveDestination, currency)}
      </span>
    </div>
  );
}
