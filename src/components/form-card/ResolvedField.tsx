import { cn } from '@/lib/cn';
import { Icon } from '@/components/Icon';

export interface ResolvedFieldProps {
  label: string;
  value: string;
  loading?: boolean;
  placeholder?: string;
}

export function ResolvedField({
  label,
  value,
  loading,
  placeholder = '—',
}: ResolvedFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] tracking-[0.18em] text-[#777777] uppercase">{label}</span>
      <div
        className={cn(
          'bg-[#0a0a0a] border px-3 py-2.5 text-sm min-h-[42px] flex items-center justify-between',
          value && !loading ? 'border-green-500/40' : 'border-[#333333]',
        )}
        data-testid={value && !loading ? 'resolved-account-name' : undefined}
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
        {value && !loading && (
          <Icon name="check-circle" size={14} className="text-green-400 shrink-0" />
        )}
      </div>
    </div>
  );
}
