'use client';

import { validateAmount } from '@/lib/offramp';
import { InputField } from './InputField';
import { FeeMethodSelector } from './FeeMethodSelector';
import type { FeeMethod, GasFeeOptions } from './types';

export interface AmountStepProps {
  amount: string;
  feeMethod: FeeMethod;
  gasFees: GasFeeOptions | null;
  isGasFeesLoading: boolean;
  isQuoteLoading: boolean;
  amountError?: string;
  quoteError?: string;
  touchedFields: Record<string, boolean>;
  isConnected: boolean;
  isSubmitting: boolean;
  onAmountChange: (value: string) => void;
  onFeeMethodChange: (method: FeeMethod) => void;
  onBlurAmount: () => void;
}

/**
 * Step 1 – Enter transfer amount and choose gas fee method.
 */
export function AmountStep({
  amount,
  feeMethod,
  gasFees,
  isGasFeesLoading,
  isQuoteLoading,
  amountError,
  quoteError,
  touchedFields,
  isConnected,
  isSubmitting,
  onAmountChange,
  onFeeMethodChange,
  onBlurAmount,
}: AmountStepProps) {
  return (
    <>
      <InputField
        label="Amount (USDC)"
        id="amount"
        value={amount}
        onChange={onAmountChange}
        onBlur={onBlurAmount}
        type="number"
        placeholder="0.00"
        suffix={isQuoteLoading ? '...' : 'USDC'}
        error={amountError ?? quoteError}
        success={
          validateAmount(amount) && parseFloat(amount) >= 0.7 ? 'Valid amount' : undefined
        }
        touched={touchedFields['amount']}
        disabled={!isConnected || isSubmitting}
      />

      <FeeMethodSelector
        feeMethod={feeMethod}
        gasFees={gasFees}
        isLoading={isGasFeesLoading}
        disabled={!isConnected || isSubmitting}
        onChange={onFeeMethodChange}
      />
    </>
  );
}
