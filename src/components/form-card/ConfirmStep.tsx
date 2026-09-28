'use client';

import { cn } from '@/lib/cn';
import { InsuranceOption } from '@/components/InsuranceOption';
import { PayoutBox } from './PayoutBox';
import { getCtaLabel } from './types';
import type { QuoteResult, CtaState } from './types';
import type { InsuranceQuote } from '@/components/InsuranceOption';

export interface ConfirmStepProps {
  quote: QuoteResult | null;
  currency: string;
  liveRate: number | null;
  rateFlash: boolean;
  amount: string;
  ctaState: CtaState;
  ctaDisabled: boolean;
  isConnected: boolean;
  isSubmitting: boolean;
  onToggleInsurance: (enabled: boolean, quote: InsuranceQuote | null) => void;
  onSubmit: () => void;
  onConnect: () => void;
}

/**
 * Step 3 – Review payout breakdown, optionally add insurance, and submit.
 */
export function ConfirmStep({
  quote,
  currency,
  liveRate,
  rateFlash,
  amount,
  ctaState,
  ctaDisabled,
  isConnected,
  isSubmitting,
  onToggleInsurance,
  onSubmit,
  onConnect,
}: ConfirmStepProps) {
  return (
    <>
      {quote && (
        <PayoutBox
          quote={quote}
          currency={currency}
          liveRate={liveRate}
          flash={rateFlash}
        />
      )}

      <InsuranceOption
        amount={parseFloat(amount) || 0}
        currency="USDC"
        disabled={!isConnected || isSubmitting}
        onToggle={onToggleInsurance}
      />

      <button
        onClick={ctaState === 'disconnected' ? onConnect : onSubmit}
        disabled={ctaDisabled}
        aria-label={getCtaLabel(ctaState)}
        className={cn(
          'w-full py-4 min-h-[52px] text-xs font-bold tracking-[0.2em] transition-all duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a962] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]',
          ctaState === 'ready'
            ? 'bg-[#c9a962] text-black hover:bg-[#d4b982]'
            : 'bg-[#222222] text-[#555555] cursor-not-allowed border border-[#333333]',
          (ctaState === 'connecting' || ctaState === 'submitting') && 'animate-pulse',
        )}
      >
        {getCtaLabel(ctaState)}
      </button>
    </>
  );
}
