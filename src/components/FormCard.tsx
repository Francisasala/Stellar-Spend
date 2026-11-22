'use client';

import { KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { validateAmount } from '@/lib/offramp';
import { getCurrencyFlag } from '@/lib/currency-flags';
import { FormCardSkeleton } from '@/components/skeletons';
import { BankAccountInput } from '@/components/BankAccountInput';
import { InsuranceOption } from '@/components/InsuranceOption';
import { useFxRate } from '@/hooks/useFxRate';
import {
  type Currency,
  type Institution,
  type FormCardProps,
  type CtaState,
  getCtaLabel,
} from './form-card/types';
import { InputField } from './form-card/InputField';
import { SelectField } from './form-card/SelectField';
import { ResolvedField } from './form-card/ResolvedField';
import { PayoutBox } from './form-card/PayoutBox';
import { FeeMethodSelector } from './form-card/FeeMethodSelector';
import { useFormCardState } from '@/hooks/useFormCardState';
import { bpClasses } from '@/lib/breakpoints';
import { useTranslations } from '@/lib/i18n';

export * from './form-card/types';

const MIN_VALID_AMOUNT = 0.7;
const USDC = 'USDC';
const LOADING_PLACEHOLDER = '...';
const KEYBOARD_SUBMIT_KEY = 'Enter';
const CTA_MIN_HEIGHT_CLASS = 'min-h-[52px]';
const CTA_BASE_CLASSES =
  'w-full py-4 text-xs font-bold tracking-[0.2em] transition-all duration-200';
const CTA_FOCUS_CLASSES =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a962] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]';
const CTA_READY_CLASSES = 'bg-[#c9a962] text-black hover:bg-[#d4b982]';
const CTA_DISABLED_CLASSES =
  'bg-[#222222] text-[#555555] cursor-not-allowed border border-[#333333]';
const CTA_PENDING_CLASSES = 'animate-pulse';
const ERROR_MESSAGE_CLASSES = 'text-[10px] text-red-400 tracking-wide';
const SECTION_CLASSES = 'flex flex-col gap-6';
const CARD_CLASSES = 'bg-[#111111] border border-[#333333] p-6 flex flex-col gap-6';
const GRID_CLASSES = `grid grid-cols-1 ${bpClasses.gridTwoCols} gap-4`;

export function FormCard(props: FormCardProps) {
  const { isConnecting, isConnected, onConnect, isInitialLoading } = props;

  const t = useTranslations('formCard');

  const { rate: liveRate, flash: rateFlash } = useFxRate();

  const {
    amount,
    feeMethod,
    currency,
    accountNumber,
    bankMode,
    routingNumber,
    iban,
    institution,
    accountName,
    currencies,
    institutions,
    quote,
    gasFees,
    isCurrenciesLoading,
    isInstitutionsLoading,
    isQuoteLoading,
    isVerifyingAccount,
    isGasFeesLoading,
    isSubmitting,
    amountError,
    quoteError,
    verifyError,
    touchedFields,
    touchField,
    setBankMode,
    setRoutingNumber,
    setIban,
    setInsuranceEnabled,
    setInsuranceQuote,
    handleAmountChange,
    handleCurrencyChange,
    handleInstitutionChange,
    handleAccountNumberChange,
    handleFeeMethodChange,
    submitOfframp,
  } = useFormCardState(props);

  if (isInitialLoading) {
    return <FormCardSkeleton />;
  }

  const ctaState: CtaState = isConnecting
    ? 'connecting'
    : !isConnected
      ? 'disconnected'
      : isSubmitting
        ? 'submitting'
        : 'ready';

  const ctaDisabled =
    ctaState === 'connecting' ||
    ctaState === 'submitting' ||
    (ctaState === 'ready' &&
      (!amount ||
        !!amountError ||
        !currency ||
        !institution ||
        !accountNumber ||
        !accountName ||
        !!verifyError));

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === KEYBOARD_SUBMIT_KEY && !ctaDisabled) {
      event.preventDefault();
      void submitOfframp();
    }
  };

  return (
    <section
      className={SECTION_CLASSES}
      onKeyDown={handleKeyDown}
      aria-label="Off-ramp form"
      aria-busy={isSubmitting}
    >
      <div className={CARD_CLASSES}>
        <InputField
          label={t('amountLabel')}
          id="amount"
          value={amount}
          onChange={handleAmountChange}
          onBlur={() => touchField('amount')}
          type="number"
          placeholder={t('amountPlaceholder')}
          suffix={isQuoteLoading ? LOADING_PLACEHOLDER : USDC}
          error={amountError || quoteError}
          success={
            validateAmount(amount) && parseFloat(amount) >= MIN_VALID_AMOUNT
              ? t('validAmount')
              : undefined
          }
          touched={touchedFields['amount']}
          disabled={!isConnected || isSubmitting}
          aria-describedby="amount-error"
        />

        <FeeMethodSelector
          feeMethod={feeMethod}
          gasFees={gasFees}
          isLoading={isGasFeesLoading}
          disabled={!isConnected || isSubmitting}
          onChange={handleFeeMethodChange}
        />

        <div className={GRID_CLASSES}>
          <SelectField
            label={t('currencyLabel')}
            id="currency"
            value={currency}
            options={currencies.map((c: Currency) => {
              const flag = getCurrencyFlag(c.code);
              return {
                value: c.code,
                label: flag
                  ? t('currencyOptionWithFlag', { flag, name: c.name, code: c.code })
                  : t('currencyOption', { name: c.name, code: c.code }),
              };
            })}
            onChange={handleCurrencyChange}
            onBlur={() => touchField('currency')}
            loading={isCurrenciesLoading}
            disabled={!isConnected || isSubmitting}
            error={t('currencyError')}
            touched={touchedFields['currency']}
          />
          <SelectField
            label={t('institutionLabel')}
            id="institution"
            value={institution}
            options={institutions.map((i: Institution) => ({ value: i.code, label: i.name }))}
            onChange={handleInstitutionChange}
            onBlur={() => touchField('institution')}
            loading={isInstitutionsLoading}
            disabled={!currency || !isConnected || isSubmitting}
            placeholder={
              currency ? t('institutionPlaceholder') : t('institutionPlaceholderNoCurrency')
            }
            error={t('institutionError')}
            touched={touchedFields['institution']}
          />
        </div>

        <BankAccountInput
          mode={bankMode}
          onModeChange={setBankMode}
          accountNumber={accountNumber}
          onAccountNumberChange={handleAccountNumberChange}
          routingNumber={routingNumber}
          onRoutingNumberChange={setRoutingNumber}
          iban={iban}
          onIbanChange={setIban}
          disabled={!institution || !isConnected || isSubmitting}
          aria-describedby={verifyError ? 'verify-error' : undefined}
        />

        {verifyError && (
          <span
            id="verify-error"
            role="alert"
            data-testid="error-message"
            className={ERROR_MESSAGE_CLASSES}
          >
            {verifyError}
          </span>
        )}

        <ResolvedField
          label={t('accountNameLabel')}
          value={accountName}
          loading={isVerifyingAccount}
          placeholder={accountNumber ? t('accountNameVerifying') : t('accountNamePlaceholder')}
        />

        {quote && (
          <PayoutBox quote={quote} currency={currency} liveRate={liveRate} flash={rateFlash} />
        )}

        <InsuranceOption
          amount={parseFloat(amount) || 0}
          currency={USDC}
          disabled={!isConnected || isSubmitting}
          onToggle={(enabled, selectedQuote) => {
            setInsuranceEnabled(enabled);
            setInsuranceQuote(selectedQuote);
          }}
        />

        <button
          type="button"
          onClick={ctaState === 'disconnected' ? onConnect : () => void submitOfframp()}
          disabled={ctaDisabled}
          aria-label={getCtaLabel(ctaState)}
          aria-busy={ctaState === 'connecting' || ctaState === 'submitting'}
          data-testid="offramp-cta-button"
          className={cn(
            CTA_BASE_CLASSES,
            CTA_MIN_HEIGHT_CLASS,
            CTA_FOCUS_CLASSES,
            ctaState === 'ready' ? CTA_READY_CLASSES : CTA_DISABLED_CLASSES,
            (ctaState === 'connecting' || ctaState === 'submitting') && CTA_PENDING_CLASSES,
          )}
        >
          {getCtaLabel(ctaState)}
        </button>
      </div>
    </section>
  );
}
