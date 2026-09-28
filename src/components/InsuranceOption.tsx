'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import {
  type InsuranceQuote,
  type InsuranceOptionProps,
  calculateQuote,
} from './insurance-option/types';
import { TermsModal } from './insurance-option/TermsModal';
import { PremiumBreakdown } from './insurance-option/PremiumBreakdown';

export * from './insurance-option/types';

export function InsuranceOption({
  amount,
  currency = 'USDC',
  onToggle,
  disabled = false,
}: InsuranceOptionProps) {
  const [enabled, setEnabled] = useState(false);
  const [quote, setQuote] = useState<InsuranceQuote | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const { t } = useI18n();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recalculate quote whenever amount/currency changes
  useEffect(() => {
    if (amount <= 0) {
      setQuote(null);
      if (enabled) {
        onToggle(false, null);
      }
      setEnabled(false);
      setTimeLeft(null);
      return;
    }
    const q = calculateQuote(amount, currency);
    setQuote(q);
    if (enabled) {
      onToggle(true, q);
    }
  }, [amount, currency, enabled, onToggle]);

  // Countdown timer for quote expiry
  useEffect(() => {
    if (!quote || !enabled) {
      setTimeLeft(null);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const tick = () => {
      const remaining = quote.expiresAt - Date.now();
      if (remaining <= 0) {
        setTimeLeft(0);
        const fresh = calculateQuote(amount, currency);
        setQuote(fresh);
        onToggle(true, fresh);
      } else {
        setTimeLeft(remaining);
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [quote, enabled, amount, currency, onToggle]);

  const handleToggle = useCallback(() => {
    if (disabled || amount <= 0) return;
    const newState = !enabled;
    setEnabled(newState);
    if (newState && !quote) {
      const q = calculateQuote(amount, currency);
      setQuote(q);
      onToggle(true, q);
    } else {
      onToggle(newState, newState ? quote : null);
    }
  }, [disabled, amount, currency, enabled, quote, onToggle]);

  const isDisabled = disabled || amount <= 0;

  return (
    <>
      <div
        className={cn(
          'border transition-colors duration-150',
          enabled
            ? 'border-[#c9a962] bg-[#c9a962]/5 shadow-[inset_0_0_20px_rgba(201,169,98,0.05)]'
            : 'border-[#333333] bg-[#0a0a0a]',
          isDisabled && 'opacity-50 cursor-not-allowed',
        )}
        role="group"
        aria-labelledby="insurance-option-label"
      >
        {/* Header row */}
        <div className="px-4 py-3 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Toggle switch */}
            <button
              role="switch"
              aria-checked={enabled}
              aria-labelledby="insurance-option-label"
              aria-disabled={isDisabled}
              onClick={handleToggle}
              disabled={isDisabled}
              className={cn(
                'relative flex-shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a962] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
                enabled ? 'bg-[#c9a962]' : 'bg-[#333333]',
                isDisabled && 'cursor-not-allowed',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200',
                  enabled && 'translate-x-5',
                )}
                aria-hidden="true"
              />
            </button>

            {/* Label + description */}
            <div className="flex-1 min-w-0">
              <p
                id="insurance-option-label"
                className={cn(
                  'text-sm font-semibold tracking-wide',
                  enabled ? 'text-[#c9a962]' : 'text-white',
                )}
              >
                {t('insurance.title')}
              </p>
              <p className="text-xs text-[#777777] mt-0.5">{t('insurance.description')}</p>
            </div>
          </div>

          {/* Terms link */}
          <button
            onClick={() => setShowTerms(true)}
            className={cn(
              'flex-shrink-0 text-[10px] tracking-widest uppercase text-[#777777]',
              'hover:text-[#c9a962] transition-colors duration-150',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]',
            )}
            aria-label="View insurance terms and conditions"
          >
            {t('insurance.terms')}
          </button>
        </div>

        {/* Premium breakdown */}
        {quote && amount > 0 && (
          <PremiumBreakdown
            quote={quote}
            amount={amount}
            enabled={enabled}
            timeLeft={timeLeft}
          />
        )}

        {/* Disabled hint */}
        {amount <= 0 && (
          <div className="border-t border-[#222222] px-4 py-2">
            <p className="text-[10px] text-[#555555] tracking-wide italic">
              Enter a transaction amount to see insurance options
            </p>
          </div>
        )}
      </div>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </>
  );
}

export default InsuranceOption;
