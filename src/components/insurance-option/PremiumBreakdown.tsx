'use client';

import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import {
  type InsuranceQuote,
  PROVIDER_LABELS,
  RISK_LABELS,
  getRiskBand,
  formatAmount,
  formatCountdown,
} from './types';

export interface PremiumBreakdownProps {
  quote: InsuranceQuote;
  amount: number;
  enabled: boolean;
  timeLeft: number | null;
}

export function PremiumBreakdown({
  quote,
  amount,
  enabled,
  timeLeft,
}: PremiumBreakdownProps) {
  const { t } = useI18n();
  const riskBand = getRiskBand(quote.riskScore);
  const riskInfo = RISK_LABELS[riskBand];

  return (
    <div className="border-t border-[#222222] px-4 py-3 flex flex-col gap-2 bg-[#0d0d0d]">
      {/* Provider tier badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-widest uppercase text-[#777777]">
          {t('insurance.provider')}
        </span>
        <span
          className={cn(
            'text-[10px] tracking-widest uppercase px-2 py-0.5 border font-bold',
            quote.provider === 'enterprise'
              ? 'border-[#c9a962] text-[#c9a962]'
              : quote.provider === 'premium'
                ? 'border-[#60a5fa] text-[#60a5fa]'
                : 'border-[#555555] text-[#aaaaaa]',
          )}
        >
          {PROVIDER_LABELS[quote.provider]}
        </span>
      </div>

      {/* Risk score */}
      {riskInfo && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] tracking-widest uppercase text-[#777777]">
            {t('insurance.risk_score')}
          </span>
          <span className={cn('text-xs tabular-nums font-semibold', riskInfo.color)}>
            {quote.riskScore}/100 — {riskInfo.label}
          </span>
        </div>
      )}

      {/* Premium */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-widest uppercase text-[#777777]">
          {t('insurance.premium')}
        </span>
        <div className="text-right">
          <div className="text-xs text-white tabular-nums font-bold">
            {formatAmount(quote.premium)} USDC
          </div>
          <div className="text-[9px] text-[#555555] tracking-widest uppercase mt-0.5">
            ({amount >= 10000 ? '0.3%' : '0.5%'} fixed rate)
          </div>
        </div>
      </div>

      {/* Coverage */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[10px] tracking-widest uppercase text-[#777777]">
          {t('insurance.coverage')}
        </span>
        <span className="text-xs text-[#4ade80] tabular-nums font-black">
          Up to {formatAmount(quote.coverage)} USDC
        </span>
      </div>

      {/* Quote expiry countdown */}
      {enabled && timeLeft !== null && (
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#222222]">
          <span className="text-[10px] tracking-widest uppercase text-[#777777]">
            {t('insurance.expires')}
          </span>
          <span
            className={cn(
              'text-[10px] tabular-nums font-mono font-bold',
              timeLeft < 60000 ? 'text-[#f87171] animate-pulse' : 'text-[#777777]',
            )}
            aria-live="polite"
            aria-label={`Quote expires in ${formatCountdown(timeLeft)}`}
          >
            {formatCountdown(timeLeft)}
          </span>
        </div>
      )}
    </div>
  );
}
