'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/cn';
import {
  validateBankField,
  type BankFieldType,
  type ValidationResult,
} from '@/lib/bank-validation';

interface BankFieldProps {
  type: BankFieldType;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

const DEFAULTS: Record<BankFieldType, { label: string; placeholder: string; maxLength: number }> = {
  account: { label: 'Account Number', placeholder: 'e.g. 0123456789', maxLength: 20 },
  routing: { label: 'Routing Number (ABA)', placeholder: '9-digit ABA number', maxLength: 9 },
  iban: { label: 'IBAN', placeholder: 'e.g. GB29NWBK60161331926819', maxLength: 34 },
};

export function BankField({ type, value, onChange, label, placeholder, disabled }: BankFieldProps) {
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<ValidationResult>({ valid: true });

  const defaults = DEFAULTS[type];

  const handleChange = useCallback(
    (raw: string) => {
      onChange(raw);
      if (touched) setResult(validateBankField(type, raw));
    },
    [type, touched, onChange],
  );

  const handleBlur = useCallback(() => {
    setTouched(true);
    setResult(validateBankField(type, value));
  }, [type, value]);

  const showError = touched && !result.valid;
  const showSuccess = touched && result.valid && value.trim().length > 0;

  const borderColorClass = showError ? 'border-error' : showSuccess ? 'border-success' : 'border-line';

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`bank-field-${type}`} className="text-[11px] text-muted tracking-[0.08em]">
        {label ?? defaults.label}
      </label>

      <div
        className={cn(
          'flex items-center h-[46px] border px-3 gap-2 transition-colors duration-150',
          borderColorClass,
        )}
      >
        <input
          id={`bank-field-${type}`}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder ?? defaults.placeholder}
          maxLength={defaults.maxLength}
          disabled={disabled}
          aria-invalid={showError}
          aria-describedby={showError ? `bank-field-${type}-error` : undefined}
          data-testid={type === 'account' ? 'account-number-input' : `bank-field-${type}-input`}
          className={cn(
            'flex-1 bg-transparent border-0 outline-none text-text text-sm font-ibm-plex-mono tracking-[0.04em]',
            disabled ? 'opacity-50' : 'opacity-100',
          )}
        />
        {showSuccess && (
          <span className="text-success text-sm shrink-0" aria-hidden>
            ✓
          </span>
        )}
        {showError && (
          <span className="text-error text-sm shrink-0" aria-hidden>
            ✕
          </span>
        )}
      </div>

      {showError && (
        <p id={`bank-field-${type}-error`} role="alert" className="text-[11px] text-error m-0">
          {result.error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composite component: full bank account form with mode switching
// ---------------------------------------------------------------------------

export type BankMode = 'local' | 'us' | 'iban';

interface BankAccountInputProps {
  mode: BankMode;
  onModeChange: (m: BankMode) => void;
  accountNumber: string;
  onAccountNumberChange: (v: string) => void;
  routingNumber?: string;
  onRoutingNumberChange?: (v: string) => void;
  iban?: string;
  onIbanChange?: (v: string) => void;
  disabled?: boolean;
}

const MODE_LABELS: Record<BankMode, string> = {
  local: 'Local',
  us: 'US (ABA)',
  iban: 'IBAN',
};

export function BankAccountInput({
  mode,
  onModeChange,
  accountNumber,
  onAccountNumberChange,
  routingNumber = '',
  onRoutingNumberChange,
  iban = '',
  onIbanChange,
  disabled,
}: BankAccountInputProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Mode tabs */}
      <div className="flex gap-0 border-b border-line">
        {(['local', 'us', 'iban'] as BankMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={cn(
              'text-[11px] px-3.5 py-1.5 border-0 border-b-2 bg-transparent cursor-pointer -mb-px tracking-[0.06em]',
              mode === m ? 'border-accent text-accent' : 'border-transparent text-muted',
            )}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Fields */}
      {mode === 'local' && (
        <BankField
          type="account"
          value={accountNumber}
          onChange={onAccountNumberChange}
          disabled={disabled}
        />
      )}

      {mode === 'us' && (
        <>
          <BankField
            type="routing"
            value={routingNumber}
            onChange={onRoutingNumberChange ?? (() => {})}
            disabled={disabled}
          />
          <BankField
            type="account"
            value={accountNumber}
            onChange={onAccountNumberChange}
            disabled={disabled}
          />
        </>
      )}

      {mode === 'iban' && (
        <BankField
          type="iban"
          value={iban}
          onChange={onIbanChange ?? (() => {})}
          disabled={disabled}
        />
      )}
    </div>
  );
}
