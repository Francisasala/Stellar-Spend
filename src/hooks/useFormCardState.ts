'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { validateAmount, validateAccountNumber } from '@/lib/offramp';
import type { BankMode } from '@/components/BankAccountInput';
import type { InsuranceQuote } from '@/components/InsuranceOption';
import type {
  FeeMethod,
  QuoteResult,
  Currency,
  Institution,
  GasFeeOptions,
  FormCardProps,
} from '@/components/form-card/types';
import {
  fetchCurrencies,
  fetchGasFees,
  fetchInstitutions,
  fetchQuote as fetchQuoteService,
  verifyAccount as verifyAccountService,
} from '@/components/form-card/formCardServices';

export function useFormCardState({
  resetKey = 0,
  onQuoteChange,
  onAmountChange,
  onCurrencyChange,
  onSubmit,
}: Pick<FormCardProps, 'resetKey' | 'onQuoteChange' | 'onAmountChange' | 'onCurrencyChange' | 'onSubmit'>) {
  const [amount, setAmount] = useState('');
  const [feeMethod, setFeeMethod] = useState<FeeMethod>('USDC');
  const [currency, setCurrency] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankMode, setBankMode] = useState<BankMode>('local');
  const [routingNumber, setRoutingNumber] = useState('');
  const [iban, setIban] = useState('');
  const [institution, setInstitution] = useState('');
  const [accountName, setAccountName] = useState('');

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [insuranceQuote, setInsuranceQuote] = useState<InsuranceQuote | null>(null);
  const [insuranceEnabled, setInsuranceEnabled] = useState(false);
  const [gasFees, setGasFees] = useState<GasFeeOptions | null>(null);

  const [isCurrenciesLoading, setIsCurrenciesLoading] = useState(false);
  const [isInstitutionsLoading, setIsInstitutionsLoading] = useState(false);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [isVerifyingAccount, setIsVerifyingAccount] = useState(false);
  const [isGasFeesLoading, setIsGasFeesLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [amountError, setAmountError] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [verifyError, setVerifyError] = useState('');

  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const touchField = (field: string) => setTouchedFields((prev) => ({ ...prev, [field]: true }));

  const quoteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (resetKey === 0) return;
    setAmount('');
    setFeeMethod('USDC');
    setCurrency('');
    setAccountNumber('');
    setRoutingNumber('');
    setIban('');
    setInstitution('');
    setAccountName('');
    setQuote(null);
    setInsuranceQuote(null);
    setInsuranceEnabled(false);
    onQuoteChange?.(null);
    setAmountError('');
    setQuoteError('');
    setVerifyError('');
    setTouchedFields({});
  }, [resetKey, onQuoteChange]);

  useEffect(() => {
    setIsCurrenciesLoading(true);
    fetchCurrencies()
      .then((data) => {
        setCurrencies(data);
        if (data.some((c) => c.code === 'NGN')) {
          setCurrency('NGN');
          onCurrencyChange?.('NGN');
        }
      })
      .catch(() => {})
      .finally(() => setIsCurrenciesLoading(false));
  }, [onCurrencyChange]);

  useEffect(() => {
    setIsGasFeesLoading(true);
    fetchGasFees()
      .then((data) => setGasFees(data))
      .catch(() => setGasFees(null))
      .finally(() => setIsGasFeesLoading(false));
  }, []);

  useEffect(() => {
    if (!currency) {
      setInstitutions([]);
      setInstitution('');
      return;
    }
    setIsInstitutionsLoading(true);
    setInstitution('');
    setAccountName('');
    fetchInstitutions(currency)
      .then((data) => setInstitutions(data))
      .catch(() => {})
      .finally(() => setIsInstitutionsLoading(false));
  }, [currency]);

  const fetchQuote = useCallback(
    (amt: string, cur: string, fee: FeeMethod) => {
      if (quoteDebounceRef.current) clearTimeout(quoteDebounceRef.current);
      const num = parseFloat(amt);
      if (!amt || isNaN(num) || num < 0.7 || !cur) {
        setQuote(null);
        onQuoteChange?.(null);
        return;
      }
      quoteDebounceRef.current = setTimeout(async () => {
        setIsQuoteLoading(true);
        setQuoteError('');
        try {
          const result = await fetchQuoteService(amt, cur, fee);
          setQuote(result);
          onQuoteChange?.(result);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Could not fetch quote';
          if (!msg.includes('Not implemented')) setQuoteError(msg);
          setQuote(null);
          onQuoteChange?.(null);
        } finally {
          setIsQuoteLoading(false);
        }
      }, 500);
    },
    [onQuoteChange],
  );

  const verifyAccount = useCallback((accNum: string, inst: string, cur: string) => {
    if (verifyDebounceRef.current) clearTimeout(verifyDebounceRef.current);
    if (!validateAccountNumber(accNum) || !inst || !cur) {
      setAccountName('');
      return;
    }
    verifyDebounceRef.current = setTimeout(async () => {
      setIsVerifyingAccount(true);
      setVerifyError('');
      setAccountName('');
      try {
        const name = await verifyAccountService(inst, accNum, cur);
        setAccountName(name);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not verify account';
        setVerifyError(msg);
      } finally {
        setIsVerifyingAccount(false);
      }
    }, 400);
  }, []);

  const handleAmountChange = (val: string) => {
    setAmount(val);
    onAmountChange?.(val);
    if (!val) {
      setAmountError('');
    } else if (!validateAmount(val)) {
      setAmountError('Enter a valid number');
    } else if (parseFloat(val) < 0.7) {
      setAmountError('Minimum amount is 0.7 USDC');
    } else {
      setAmountError('');
    }
    fetchQuote(val, currency, feeMethod);
  };

  const handleCurrencyChange = (val: string) => {
    setCurrency(val);
    onCurrencyChange?.(val);
    fetchQuote(amount, val, feeMethod);
  };

  const handleInstitutionChange = (val: string) => {
    setInstitution(val);
    setAccountName('');
    setVerifyError('');
    if (accountNumber) verifyAccount(accountNumber, val, currency);
  };

  const handleAccountNumberChange = (val: string) => {
    setAccountNumber(val);
    verifyAccount(val, institution, currency);
  };

  const handleFeeMethodChange = (m: FeeMethod) => {
    setFeeMethod(m);
    fetchQuote(amount, currency, m);
  };

  const submitOfframp = async () => {
    setTouchedFields({
      amount: true,
      currency: true,
      institution: true,
      accountNumber: true,
    });

    if (
      !amount ||
      !currency ||
      !institution ||
      !accountNumber ||
      !accountName ||
      amountError ||
      verifyError
    ) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        amount,
        currency,
        institution,
        accountIdentifier: accountNumber,
        accountName,
        feeMethod,
        bankMode,
        routingNumber: routingNumber || undefined,
        iban: iban || undefined,
        quote,
        insurance: {
          enabled: insuranceEnabled,
          quote: insuranceQuote,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
    insuranceQuote,
    insuranceEnabled,
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
  };
}
