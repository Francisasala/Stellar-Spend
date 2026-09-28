import { ChangeEvent } from 'react';
import { cn } from '@/lib/cn';

export interface SelectFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  touched?: boolean;
}

export function SelectField({
  label,
  id,
  value,
  onChange,
  onBlur,
  options,
  placeholder = 'Select...',
  disabled,
  loading,
  error,
  touched,
}: SelectFieldProps) {
  const showError = touched && !!error && !value;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[10px] tracking-[0.18em] text-[#777777] uppercase">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled || loading}
          aria-invalid={showError ? 'true' : undefined}
          aria-describedby={showError ? `${id}-error` : undefined}
          className={cn(
            'w-full appearance-none bg-[#0a0a0a] border px-3 py-2.5 text-sm',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962] focus:border-[#c9a962]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'transition-colors duration-150',
            showError ? 'border-red-500/60' : value ? 'border-[#c9a962]/40' : 'border-[#333333]',
            value ? 'text-white' : 'text-[#444444]',
          )}
        >
          <option value="" disabled>
            {loading ? 'Loading...' : placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#111111] text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#777777] text-xs">
          ▾
        </span>
      </div>
      {showError && (
        <span id={`${id}-error`} role="alert" className="text-[10px] text-red-400 tracking-wide">
          {error}
        </span>
      )}
    </div>
  );
}
