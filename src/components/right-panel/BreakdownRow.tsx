import { cn } from '@/lib/cn';

export interface BreakdownRowProps {
  label: string;
  value: string;
  muted?: boolean;
}

export function BreakdownRow({ label, value, muted }: BreakdownRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={cn('text-xs tracking-wider', muted ? 'text-[#777777]' : 'text-[#aaaaaa]')}>
        {label}
      </span>
      <span
        className={cn(
          'text-xs tracking-wider tabular-nums',
          muted ? 'text-[#777777]' : 'text-white',
        )}
      >
        {value}
      </span>
    </div>
  );
}
