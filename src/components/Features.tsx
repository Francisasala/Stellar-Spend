/**
 * Features - Server Component
 * Static feature descriptions rendered on server
 */

import { useTranslations } from 'next-intl';

const FEATURE_HIGHLIGHTS = [
  { labelKey: 'securityLabel', valueKey: 'securityValue' },
  { labelKey: 'coverageLabel', valueKey: 'coverageValue' },
] as const;

export default function Features() {
  const t = useTranslations('features');

  return (
    <section className="features-section grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
      <div className="racing-border-wrapper rounded-[1.75rem]">
        <div className="racing-border-content flex h-full flex-col justify-between rounded-[calc(1.75rem-2px)] border border-line/70 p-6 sm:p-8">
          <div className="space-y-4">
            <p className="font-space-grotesk text-xs font-medium uppercase tracking-[0.3em] text-accent">
              {t('eyebrow')}
            </p>
            <h2 className="font-space-grotesk text-2xl font-semibold text-text">{t('title')}</h2>
            <p className="max-w-2xl text-sm leading-7 text-muted">{t('description')}</p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {FEATURE_HIGHLIGHTS.map(({ labelKey, valueKey }) => (
              <div
                key={labelKey}
                className="feature-stat-card rounded-2xl border border-line/80 bg-bg/70 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-muted">{t(labelKey)}</p>
                <p className="mt-3 font-space-grotesk text-base text-text">{t(valueKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="feature-card rounded-[1.75rem] border border-line/70 bg-panel/90 p-6">
          <div className="flex items-center justify-between">
            <p className="font-space-grotesk text-lg font-medium text-text">{t('trackingTitle')}</p>
            <div className="animate-spin-slow rounded-full border border-accent/40 p-2">
              <div className="h-4 w-4 rounded-full bg-accent" />
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-muted">{t('trackingDescription')}</p>
        </div>

        <div className="feature-card rounded-[1.75rem] border border-line/70 bg-bg/70 p-6">
          <p className="font-space-grotesk text-lg font-medium text-text">
            {t('multiCurrencyTitle')}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted">{t('multiCurrencyDescription')}</p>
        </div>
      </div>
    </section>
  );
}
