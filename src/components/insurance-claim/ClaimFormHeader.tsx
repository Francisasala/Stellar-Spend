'use client';

import { useI18n } from '@/lib/i18n';
import { formatUsdcAmount } from '@/lib/format';

export interface ClaimFormHeaderProps {
  coverage: number;
  onCancel: () => void;
}

export function ClaimFormHeader({ coverage, onCancel }: ClaimFormHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2
          id="claim-form-title"
          className="text-sm font-semibold text-white tracking-wider uppercase"
        >
          {t('insurance.claim_title')}
        </h2>
        <p className="text-xs text-[#777777] mt-1">
          {t('insurance.coverage')} up to{' '}
          <span className="text-[#4ade80] font-bold">
            {formatUsdcAmount(coverage, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} USDC
          </span>
        </p>
      </div>
      <button
        onClick={onCancel}
        aria-label="Close claim form"
        className="text-[#777777] hover:text-white transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]"
      >
        ✕
      </button>
    </div>
  );
}
