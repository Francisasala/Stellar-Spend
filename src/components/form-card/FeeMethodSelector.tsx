import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import type { FeeMethod, GasFeeOptions } from './types';

export interface FeeMethodSelectorProps {
  feeMethod: FeeMethod;
  gasFees: GasFeeOptions | null;
  isLoading: boolean;
  disabled?: boolean;
  onChange: (method: FeeMethod) => void;
}

export function FeeMethodSelector({
  feeMethod,
  gasFees,
  isLoading,
  disabled,
  onChange,
}: FeeMethodSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] tracking-[0.18em] text-[#777777] uppercase">
        Gas Fee Method
      </span>
      {isLoading ? (
        <div className="flex gap-2">
          <Skeleton width="50%" height={44} aria-label="Loading fee option…" />
          <Skeleton width="50%" height={44} aria-label="Loading fee option…" />
        </div>
      ) : (
        <div className="flex gap-2">
          {(['USDC', 'XLM'] as FeeMethod[]).map((m) => {
            const fee = m === 'USDC' ? gasFees?.usdcFee : gasFees?.xlmFee;
            const active = feeMethod === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onChange(m)}
                disabled={disabled}
                className={cn(
                  'flex-1 py-2.5 px-3 min-h-[44px] text-xs tracking-widest border transition-colors duration-150',
                  'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  active
                    ? 'border-[#c9a962] bg-[#c9a962]/10 text-[#c9a962]'
                    : 'border-[#333333] bg-[#0a0a0a] text-[#777777] hover:border-[#c9a962]/50',
                )}
              >
                <span className="block font-semibold">{m}</span>
                {fee && <span className="block text-[10px] mt-0.5 opacity-80">{fee}</span>}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-[#666666] leading-relaxed">
        {feeMethod === 'XLM'
          ? 'XLM will be used to cover Stellar network fees.'
          : 'A small USDC amount will be deducted to cover network fees.'}
      </p>
    </div>
  );
}
