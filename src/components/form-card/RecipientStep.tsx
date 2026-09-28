'use client';

import { getCurrencyFlag } from '@/lib/currency-flags';
import { BankAccountInput, type BankMode } from '@/components/BankAccountInput';
import { SelectField } from './SelectField';
import { ResolvedField } from './ResolvedField';
import type { Currency, Institution } from './types';

export interface RecipientStepProps {
  currency: string;
  institution: string;
  currencies: Currency[];
  institutions: Institution[];
  isCurrenciesLoading: boolean;
  isInstitutionsLoading: boolean;
  isVerifyingAccount: boolean;
  accountNumber: string;
  accountName: string;
  bankMode: BankMode;
  routingNumber: string;
  iban: string;
  verifyError?: string;
  touchedFields: Record<string, boolean>;
  isConnected: boolean;
  isSubmitting: boolean;
  onCurrencyChange: (value: string) => void;
  onInstitutionChange: (value: string) => void;
  onAccountNumberChange: (value: string) => void;
  onBankModeChange: (mode: BankMode) => void;
  onRoutingNumberChange: (value: string) => void;
  onIbanChange: (value: string) => void;
  onBlurCurrency: () => void;
  onBlurInstitution: () => void;
}

/**
 * Step 2 – Select destination currency, bank, and enter account details.
 */
export function RecipientStep({
  currency,
  institution,
  currencies,
  institutions,
  isCurrenciesLoading,
  isInstitutionsLoading,
  isVerifyingAccount,
  accountNumber,
  accountName,
  bankMode,
  routingNumber,
  iban,
  verifyError,
  touchedFields,
  isConnected,
  isSubmitting,
  onCurrencyChange,
  onInstitutionChange,
  onAccountNumberChange,
  onBankModeChange,
  onRoutingNumberChange,
  onIbanChange,
  onBlurCurrency,
  onBlurInstitution,
}: RecipientStepProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          onChange={onCurrencyChange}
          onBlur={onBlurCurrency}
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
          onChange={onInstitutionChange}
          onBlur={onBlurInstitution}
          loading={isInstitutionsLoading}
          disabled={!currency || !isConnected || isSubmitting}
          placeholder={currency ? 'Select bank...' : 'Select currency first'}
          error="Please select a bank"
          touched={touchedFields['institution']}
        />
      </div>

      <BankAccountInput
        mode={bankMode}
        onModeChange={onBankModeChange}
        accountNumber={accountNumber}
        onAccountNumberChange={onAccountNumberChange}
        routingNumber={routingNumber}
        onRoutingNumberChange={onRoutingNumberChange}
        iban={iban}
        onIbanChange={onIbanChange}
        disabled={!institution || !isConnected || isSubmitting}
      />

      {verifyError && (
        <span role="alert" className="text-[10px] text-red-400 tracking-wide">
          {verifyError}
        </span>
      )}

      <ResolvedField
        label="Account Name"
        value={accountName}
        loading={isVerifyingAccount}
        placeholder={accountNumber ? 'Verifying…' : 'Enter account number to verify'}
      />
    </>
  );
}
