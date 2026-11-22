import { cn } from '@/lib/cn';
import { Icon } from '@/components/Icon';

export interface ResolvedFieldProps {
  label: string;
  value: string;
  loading?: boolean;
  placeholder?: string;
}

export function ResolvedField({ label, value, loading, placeholder = '—' }: ResolvedFieldProps) {
  const isResolved = Boolean(value) && !loading;
  const statusText = loading ? 'Resolving...' : value ? value : placeholder;

  return (
    <div className="flex flex-col gap-1.5">
      <span
        id="resolved-field-label"
        className="text-[10px] tracking-[0.18em] text-[#777777] uppercase"
      >
        {label}
      </span>
      <div
        role="status"
        aria-live="polite"
        aria-busy={loading ? true : undefined}
        aria-labelledby="resolved-field-label"
        aria-label={`${label}: ${statusText}`}
        className={cn(
          'bg-[#0a0a0a] border px-3 py-2.5 text-sm min-h-[42px] flex items-center justify-between',
          isResolved ? 'border-green-500/40' : 'border-[#333333]',
        )}
        data-testid={isResolved ? 'resolved-account-name' : undefined}
      >
        <span>
          {loading ? (
            <span className="text-[#777777] text-xs tracking-wider">Resolving...</span>
          ) : value ? (
            <span className="text-[#c9a962]">{value}</span>
          ) : (
            <span className="text-[#444444]">{placeholder}</span>
          )}
        </span>
        {isResolved && (
          <Icon
            name="check-circle"
            size={14}
            className="text-green-400 shrink-0"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
