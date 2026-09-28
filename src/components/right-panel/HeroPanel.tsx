'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import {
  type RightPanelProps,
  getCurrencySymbol,
  formatFiat,
  formatRate,
} from './types';

export function HeroPanel({
  isConnected,
  isConnecting,
  amount,
  quote,
  isLoadingQuote,
  currency,
  onConnect,
  liveRate,
  flash,
}: RightPanelProps & { liveRate: number | null; flash: boolean }) {
  const hasAmount = amount && parseFloat(amount) > 0;
  const effectiveRate = liveRate ?? quote?.rate ?? null;
  const liveDestination =
    effectiveRate && hasAmount
      ? (parseFloat(amount) * effectiveRate).toFixed(2)
      : (quote?.destinationAmount ?? null);

  let heroLabel: string;
  let heroValue: ReactNode;
  let heroMeta: string;

  if (!isConnected && !isConnecting) {
    heroLabel = 'WALLET REQUIRED';
    heroValue = <span className="text-[#777777]">{getCurrencySymbol(currency || 'NGN')} --</span>;
    heroMeta = 'Connect wallet to preview payout';
  } else if (isConnecting) {
    heroLabel = 'CONNECTING';
    heroValue = <span className="text-[#c9a962]">Awaiting signature</span>;
    heroMeta = 'Approve connection in your wallet to continue';
  } else if (isLoadingQuote) {
    heroLabel = 'CALCULATING';
    heroValue = (
      <span className="text-[#c9a962] flex items-center gap-1">
        <span className="dot-bounce [animation-delay:0ms]">.</span>
        <span className="dot-bounce [animation-delay:150ms]">.</span>
        <span className="dot-bounce [animation-delay:300ms]">.</span>
      </span>
    );
    heroMeta = 'Fetching live rate...';
  } else if (isConnected && hasAmount && (quote || liveDestination)) {
    heroLabel = 'ESTIMATED PAYOUT';
    heroValue = (
      <span className={cn('text-[#c9a962] transition-colors duration-300', flash && 'text-white')}>
        {formatFiat(liveDestination ?? quote!.destinationAmount, currency || quote!.currency)}
      </span>
    );
    heroMeta = `Rate: ${formatRate(effectiveRate ?? quote!.rate, currency || quote!.currency)}`;
  } else {
    heroLabel = 'READY TO PAYOUT';
    heroValue = <span className="text-[#777777]">Enter amount</span>;
    heroMeta = 'Wallet connected • payout route active';
  }

  return (
    <div
      className={cn(
        'border border-[#333333] bg-[#111111] p-5 flex flex-col gap-4',
        isConnecting && 'animate-[pulse_2s_ease-in-out_infinite]',
      )}
    >
      <span className="text-[10px] tracking-[0.2em] text-[#777777] uppercase">{heroLabel}</span>

      <div className="font-space-grotesk font-bold leading-none text-[clamp(1.6rem,3.5vw,2.4rem)]">
        {heroValue}
      </div>

      <span className="text-[11px] text-[#777777] tracking-wide">{heroMeta}</span>

      {!isConnected && !isConnecting && (
        <button
          onClick={onConnect}
          className={cn(
            'mt-1 w-full py-2.5 min-h-[44px] text-xs tracking-widest border border-[#c9a962]',
            'text-[#c9a962] bg-transparent transition-colors duration-150',
            'hover:bg-[#c9a962] hover:text-[#0a0a0a]',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a962] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]',
          )}
        >
          CONNECT WALLET
        </button>
      )}
    </div>
  );
}
