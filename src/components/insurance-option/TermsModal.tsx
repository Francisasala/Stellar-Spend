'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { PROVIDER_LABELS, PROVIDER_DESCRIPTIONS } from './types';

export interface TermsModalProps {
  onClose: () => void;
}

export function TermsModal({ onClose }: TermsModalProps) {
  const { t } = useI18n();

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="insurance-terms-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg border border-[#333333] bg-[#0a0a0a] p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <h2
            id="insurance-terms-title"
            className="text-sm font-semibold text-white tracking-wider uppercase"
          >
            {t('insurance.terms_title')}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close terms"
            className="text-[#777777] hover:text-white transition-colors duration-150 flex-shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 text-xs text-[#aaaaaa] leading-relaxed">
          <section>
            <h3 className="text-[10px] tracking-widest uppercase text-[#c9a962] mb-2">
              {t('insurance.coverage')}
            </h3>
            <p>
              Transaction insurance covers up to 110% of the insured transaction amount in the event
              of a verified loss. Coverage applies to failed, reversed, or fraudulent transactions
              confirmed by our review team.
            </p>
          </section>

          <section>
            <h3 className="text-[10px] tracking-widest uppercase text-[#c9a962] mb-2">
              {t('insurance.premium')}
            </h3>
            <p>
              The premium is calculated based on transaction amount, currency risk profile, and
              provider tier. Premiums are non-refundable once a transaction is submitted. High-value
              transactions (≥ $10,000 USDC) qualify for a bulk discount rate of 0.3%.
            </p>
          </section>

          <section>
            <h3 className="text-[10px] tracking-widest uppercase text-[#c9a962] mb-2">
              Filing a Claim
            </h3>
            <p>
              Claims must be filed within 30 days of the transaction date. You will need to provide
              a reason and any supporting evidence. Claims are reviewed within 5–10 business days.
              Approved claims are paid out to your connected wallet.
            </p>
          </section>

          <section>
            <h3 className="text-[10px] tracking-widest uppercase text-[#c9a962] mb-2">
              Exclusions
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Transactions cancelled by the user</li>
              <li>Losses due to user error (wrong account, wrong amount)</li>
              <li>Transactions already covered by a separate dispute</li>
              <li>Fraudulent claims</li>
            </ul>
          </section>

          <section>
            <h3 className="text-[10px] tracking-widest uppercase text-[#c9a962] mb-2">
              Provider Tiers
            </h3>
            <div className="flex flex-col gap-2">
              {(['default', 'premium', 'enterprise'] as const).map((tier) => (
                <div key={tier} className="border border-[#222222] bg-[#111111] px-3 py-2">
                  <span className="text-white font-semibold">{PROVIDER_LABELS[tier]}</span>
                  <span className="text-[#777777] ml-2">— {PROVIDER_DESCRIPTIONS[tier]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <button
          onClick={onClose}
          className={cn(
            'mt-2 w-full py-2.5 min-h-[44px] text-xs tracking-widest border border-[#c9a962]',
            'text-[#c9a962] bg-transparent transition-colors duration-150',
            'hover:bg-[#c9a962] hover:text-[#0a0a0a]',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]',
          )}
        >
          {t('common.close').toUpperCase()}
        </button>
      </div>
    </div>
  );
}
