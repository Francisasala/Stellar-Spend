'use client';

import { useI18n } from '@/lib/i18n';

export interface EligibilityStateProps {
  isChecking: boolean;
  isEligible: boolean | null;
  onCancel: () => void;
}

export function EligibilityState({ isChecking, isEligible, onCancel }: EligibilityStateProps) {
  const { t } = useI18n();

  if (isChecking) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3 bg-[#111111] border border-[#222222]">
        <div className="w-6 h-6 border-2 border-[#c9a962]/20 border-t-[#c9a962] rounded-full animate-spin" />
        <p className="text-[10px] text-[#777777] uppercase tracking-widest">
          {t('insurance.eligibility_check')}
        </p>
      </div>
    );
  }

  if (!isEligible) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500/50 flex flex-col items-center gap-3">
        <span className="text-2xl">⚠</span>
        <p className="text-xs text-red-400 text-center">{t('insurance.ineligible')}</p>
        <button
          onClick={onCancel}
          className="text-[10px] uppercase tracking-widest text-white underline"
        >
          Go Back
        </button>
      </div>
    );
  }

  return null;
}
