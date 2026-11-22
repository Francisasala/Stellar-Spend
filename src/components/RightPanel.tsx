'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { QuoteDisplaySkeleton } from './skeletons';
import { useFxRate } from '@/hooks/useFxRate';
import { CollapsibleSection } from './CollapsibleSection';
import { useTranslations } from '@/lib/i18n';
import { type RightPanelProps, formatFiat, formatNetworkFee } from './right-panel/types';
import { HeroPanel } from './right-panel/HeroPanel';
import { BreakdownRow } from './right-panel/BreakdownRow';

export * from './right-panel/types';

/** Platform fee rate applied to the entered amount. */
const PLATFORM_FEE_RATE = 0.0035;
/** Decimal places for the platform fee display. */
const PLATFORM_FEE_DECIMALS = 4;
/** Decimal places for the live destination amount. */
const DESTINATION_DECIMALS = 2;
/** Fallback platform fee label when no amount is entered. */
const PLATFORM_FEE_FALLBACK_PERCENT = '0.35%';
/** Placeholder shown while the quote is loading. */
const LOADING_PLACEHOLDER = '...';

function RightPanel(props: RightPanelProps) {
  const { quote, isConnected, isLoadingQuote, currency } = props;
  const { rate: liveRate, flash } = useFxRate();
  const t = useTranslations();

  const amountValue = useMemo(() => parseFloat(props.amount), [props.amount]);

  const platformFeeUsdc = useMemo(
    () =>
      quote && amountValue > 0
        ? `${(amountValue * PLATFORM_FEE_RATE).toFixed(PLATFORM_FEE_DECIMALS)} USDC`
        : PLATFORM_FEE_FALLBACK_PERCENT,
    [quote, amountValue],
  );

  const effectiveRate = liveRate ?? quote?.rate ?? null;

  const liveDestination = useMemo(
    () =>
      effectiveRate && props.amount && amountValue > 0
        ? (amountValue * effectiveRate).toFixed(DESTINATION_DECIMALS)
        : null,
    [effectiveRate, props.amount, amountValue],
  );

  const payoutTotal = useMemo(
    () =>
      isConnected && (liveDestination || quote) && amountValue > 0
        ? formatFiat(liveDestination ?? quote!.destinationAmount, currency || quote!.currency)
        : isLoadingQuote
          ? LOADING_PLACEHOLDER
          : t('rightPanel.payoutEmpty', { currency: currency.toUpperCase() }),
    [isConnected, liveDestination, quote, amountValue, currency, isLoadingQuote, t],
  );

  if (isLoadingQuote && !quote) {
    return <QuoteDisplaySkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <HeroPanel {...props} liveRate={liveRate} flash={flash} />

      <div className="border border-[#333333] bg-[#111111] p-5 flex flex-col gap-3">
        <span className="text-[10px] tracking-[0.2em] text-[#777777] uppercase mb-1">
          {t('rightPanel.settlementBreakdown')}
        </span>

        <BreakdownRow
          label={t('rightPanel.networkFee')}
          value={formatNetworkFee(quote)}
          muted={!quote}
        />
        <BreakdownRow label={t('rightPanel.platformFee')} value={platformFeeUsdc} muted={!quote} />

        <div className="border-t border-[#333333] my-1" />

        <div className="flex items-end justify-between gap-4">
          <span className="text-xs tracking-widest text-[#777777] uppercase">
            {t('rightPanel.payoutTotal')}
          </span>
          <span
            className={cn(
              'font-space-grotesk font-bold tabular-nums leading-none transition-colors duration-300 text-[clamp(1.1rem,2.5vw,1.5rem)]',
              isLoadingQuote ? 'text-[#777777]' : flash ? 'text-white' : 'text-[#c9a962]',
            )}
          >
            {payoutTotal}
          </span>
        </div>
      </div>

      <CollapsibleSection
        id="advanced-options"
        title={t('rightPanel.advancedOptions.title')}
        description={t('rightPanel.advancedOptions.description')}
        defaultOpen={false}
      >
        <div className="flex flex-col gap-3">
          <BreakdownRow
            label={t('rightPanel.advancedOptions.bridgeProtocol')}
            value={t('rightPanel.advancedOptions.bridgeProtocolValue')}
            muted
          />
          <BreakdownRow
            label={t('rightPanel.advancedOptions.settlementChain')}
            value={t('rightPanel.advancedOptions.settlementChainValue')}
            muted
          />
          <BreakdownRow
            label={t('rightPanel.advancedOptions.payoutProvider')}
            value={t('rightPanel.advancedOptions.payoutProviderValue')}
            muted
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}

export default memo(RightPanel);
