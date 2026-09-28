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

export * from './form-card/types';

export function FormCard(props: FormCardProps) {
  const {
    isConnecting,
    isConnected,
    onConnect,
    isInitialLoading,
  } = props;

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
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !ctaDisabled) {
      event.preventDefault();
      void submitOfframp();
    }
  };

  return (
    <section className="flex flex-col gap-6" onKeyDown={handleKeyDown}>
      <div className="bg-[#111111] border border-[#333333] p-6 flex flex-col gap-6">
        <InputField
          label="Amount (USDC)"
          id="amount"
          value={amount}
          onChange={handleAmountChange}
          onBlur={() => touchField('amount')}
          type="number"
          placeholder="0.00"
          suffix={isQuoteLoading ? '...' : 'USDC'}
          error={amountError || quoteError}
          success={validateAmount(amount) && parseFloat(amount) >= 0.7 ? 'Valid amount' : undefined}
          touched={touchedFields['amount']}
          disabled={!isConnected || isSubmitting}
        />

        <FeeMethodSelector
          feeMethod={feeMethod}
          gasFees={gasFees}
          isLoading={isGasFeesLoading}
          disabled={!isConnected || isSubmitting}
          onChange={handleFeeMethodChange}
        />

        <div className={`grid grid-cols-1 ${bpClasses.gridTwoCols} gap-4`}>
          <SelectField
            label="Currency"
            id="currency"
            value={currency}
            options={currencies.map((c: Currency) => {
              const flag = getCurrencyFlag(c.code);
              return {
                value: c.code,
                label: flag ? `${flag} ${c.name} (${c.code})` : `${c.name} (${c.code})`,
              };
            })}
            onChange={handleCurrencyChange}
            onBlur={() => touchField('currency')}
            loading={isCurrenciesLoading}
            disabled={!isConnected || isSubmitting}
            error="Please select a currency"
            touched={touchedFields['currency']}
          />
          <SelectField
            label="Bank / Institution"
            id="institution"
            value={institution}
            options={institutions.map((i: Institution) => ({ value: i.code, label: i.name }))}
            onChange={handleInstitutionChange}
            onBlur={() => touchField('institution')}
            loading={isInstitutionsLoading}
            disabled={!currency || !isConnected || isSubmitting}
            placeholder={currency ? 'Select bank...' : 'Select currency first'}
            error="Please select a bank"
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
        />

        {verifyError && (
          <span role="alert" data-testid="error-message" className="text-[10px] text-red-400 tracking-wide">
            {verifyError}
          </span>
        )}

        <ResolvedField
          label="Account Name"
          value={accountName}
          loading={isVerifyingAccount}
          placeholder={accountNumber ? 'Verifying…' : 'Enter account number to verify'}
        />

        {quote && (
          <PayoutBox quote={quote} currency={currency} liveRate={liveRate} flash={rateFlash} />
        )}

        <InsuranceOption
          amount={parseFloat(amount) || 0}
          currency="USDC"
          disabled={!isConnected || isSubmitting}
          onToggle={(enabled, selectedQuote) => {
            setInsuranceEnabled(enabled);
            setInsuranceQuote(selectedQuote);
          }}
        />

        <button
          onClick={ctaState === 'disconnected' ? onConnect : () => void submitOfframp()}
          disabled={ctaDisabled}
          aria-label={getCtaLabel(ctaState)}
          data-testid="offramp-cta-button"
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
      </div>
    </section>
  );
}

export default FormCard;
