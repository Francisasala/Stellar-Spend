import { Icon } from '@/components/Icon';

export interface WalletModalErrorProps {
  error: string;
  onDismiss: () => void;
}

export function WalletModalError({ error, onDismiss }: WalletModalErrorProps) {
  return (
    <div className="mx-4 mb-4 px-4 py-3 border border-red-500/30 bg-red-500/10 flex items-start gap-3">
      <Icon name="alert-circle" size={14} className="text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="text-red-400/60 hover:text-red-400 transition-colors shrink-0"
      >
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}
