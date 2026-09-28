import { ChangeEvent } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from '@/components/Tooltip';
import { Icon } from '@/components/Icon';

export interface InputFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  suffix?: string;
  error?: string;
  success?: string;
  touched?: boolean;
  inputMode?: 'numeric' | 'decimal' | 'text';
  help?: string;
  validating?: boolean;
}

export function InputField({
  label,
  id,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  disabled,
  suffix,
  error,
  success,
  touched,
  inputMode,
  help,
  validating,
}: InputFieldProps) {
  const showError = touched && !!error;
  const showSuccess = touched && !error && !showError && !!success && !!value && !validating;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-[10px] tracking-[0.18em] text-[#777777] uppercase">
          {label}
        </label>
        {help && (
          <Tooltip content={help} position="top">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-[#777777] hover:text-[#c9a962] cursor-help transition-colors"
              aria-label="Help"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </Tooltip>
        )}
      </div>
      <div className="relative flex items-center">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          inputMode={inputMode}
          aria-invalid={showError ? 'true' : undefined}
          aria-describedby={
            showError
              ? `${id}-error`
              : showSuccess
                ? `${id}-success`
                : help
                  ? `${id}-help`
                  : undefined
          }
          className={cn(
            'w-full bg-[#0a0a0a] border px-3 py-2.5 text-sm text-white placeholder-[#444444]',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'transition-colors duration-150',
            showError
              ? 'border-red-500/60 focus:border-red-500/80'
              : showSuccess
                ? 'border-green-500/50 focus:border-green-500/70'
                : 'border-[#333333] focus:border-[#c9a962]',
            suffix && 'pr-20',
          )}
        />
        <span className="absolute right-3 pointer-events-none select-none flex items-center gap-2">
          {validating && (
            <span
              className="inline-block h-3 w-3 border-2 border-[#c9a962] border-t-transparent rounded-full animate-spin"
              aria-label="Validating…"
            />
          )}
          {!validating && showError && <Icon name="alert-circle" size={14} className="text-red-400" />}
          {!validating && showSuccess && (
            <Icon name="check-circle" size={14} className="text-green-400" />
          )}
          {suffix && !showError && !showSuccess && !validating && (
            <span className="text-xs text-[#777777]">{suffix}</span>
          )}
        </span>
      </div>
      {showError && (
        <span id={`${id}-error`} role="alert" className="text-[10px] text-red-400 tracking-wide">
          {error}
        </span>
      )}
      {showSuccess && (
        <span id={`${id}-success`} className="text-[10px] text-green-400 tracking-wide">
          {success}
        </span>
      )}
      {!showError && !showSuccess && help && (
        <span id={`${id}-help`} className="text-[10px] text-[#666666] tracking-wide">
          {help}
        </span>
      )}
    </div>
  );
}
