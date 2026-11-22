'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { useTranslations } from '@/lib/i18n';
import { validateBankField, type BankFieldType, type ValidationResult } from '@/lib/validation';

interface BankFieldProps {
  type: BankFieldType;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

const MAX_LENGTHS: Record<BankFieldType, number> = {
  account: 20,
  routing: 9,
  iban: 34,
};

const LABEL_KEYS: Record<BankFieldType, string> = {
  account: 'bank.field.account.label',
  routing: 'bank.field.routing.label',
  iban: 'bank.field.iban.label',
};

const PLACEHOLDER_KEYS: Record<BankFieldType, string> = {
  account: 'bank.field.account.placeholder',
  routing: 'bank.field.routing.placeholder',
  iban: 'bank.field.iban.placeholder',
};

export function BankField({ type, value, onChange, label, placeholder, disabled }: BankFieldProps) {
  const t = useTranslations();
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<ValidationResult>({ valid: true });

  const maxLength = MAX_LENGTHS[type];

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

  const borderColorClass = showError
    ? 'border-error'
    : showSuccess
      ? 'border-success'
      : 'border-line';

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`bank-field-${type}`} className="text-[11px] text-muted tracking-[0.08em]">
        {label ?? t(LABEL_KEYS[type])}
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
          placeholder={placeholder ?? t(PLACEHOLDER_KEYS[type])}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={showError}
          aria-required
          aria-describedby={showError ? `bank-field-${type}-error` : undefined}
          data-testid={type === 'account' ? 'account-number-input' : `bank-field-${type}-input`}
          className={cn(
            'flex-1 bg-transparent border-0 outline-none text-text text-sm font-ibm-plex-mono tracking-[0.04em]',
            disabled ? 'opacity-50' : 'opacity-100',
          )}
        />
        {showSuccess && (
          <span className="text-success text-sm shrink-0" aria-hidden="true">
            ✓
          </span>
        )}
        {showError && (
          <span className="text-error text-sm shrink-0" aria-hidden="true">
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

const MODE_LABEL_KEYS: Record<BankMode, string> = {
  local: 'bank.mode.local',
  us: 'bank.mode.us',
  iban: 'bank.mode.iban',
};

const MODES: BankMode[] = ['local', 'us', 'iban'];

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
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-3">
      {/* Mode tabs */}
      <div
        role="tablist"
        aria-label="Bank account format"
        className="flex gap-0 border-b border-line"
      >
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`bank-mode-tab-${m}`}
            aria-selected={mode === m}
            aria-controls={`bank-mode-panel-${m}`}
            tabIndex={mode === m ? 0 : -1}
            onClick={() => onModeChange(m)}
            onKeyDown={(e) => {
              const modes: BankMode[] = ['local', 'us', 'iban'];
              const idx = modes.indexOf(m);
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const next =
                  e.key === 'ArrowRight'
                    ? modes[(idx + 1) % modes.length]
                    : modes[(idx - 1 + modes.length) % modes.length];
                onModeChange(next);
                document.getElementById(`bank-mode-tab-${next}`)?.focus();
              } else if (e.key === 'Home') {
                e.preventDefault();
                onModeChange(modes[0]);
                document.getElementById(`bank-mode-tab-${modes[0]}`)?.focus();
              } else if (e.key === 'End') {
                e.preventDefault();
                const last = modes[modes.length - 1];
                onModeChange(last);
                document.getElementById(`bank-mode-tab-${last}`)?.focus();
              }
            }}
            disabled={disabled}
            className={cn(
              'text-[11px] px-3.5 py-1.5 border-0 border-b-2 bg-transparent cursor-pointer -mb-px tracking-[0.06em]',
              mode === m ? 'border-accent text-accent' : 'border-transparent text-muted',
            )}
          >
            {t(MODE_LABEL_KEYS[m])}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div
        role="tabpanel"
        id={`bank-mode-panel-${mode}`}
        aria-labelledby={`bank-mode-tab-${mode}`}
        className="flex flex-col gap-3"
      >
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
    </div>
  );
}
