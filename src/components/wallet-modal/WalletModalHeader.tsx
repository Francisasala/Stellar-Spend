import { cn } from '@/lib/cn';
import { Icon } from '@/components/Icon';

export interface WalletModalHeaderProps {
  isConnecting: boolean;
  onClose: () => void;
}

export function WalletModalHeader({ isConnecting, onClose }: WalletModalHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-[#333333]">
      <div>
        <h2
          id="wallet-modal-title"
          className="text-sm font-bold tracking-[0.15em] text-white uppercase"
        >
          Connect Wallet
        </h2>
        <p className="text-[10px] text-[#777777] tracking-wider mt-0.5">
          Choose your Stellar wallet
        </p>
      </div>
      <button
        onClick={onClose}
        disabled={isConnecting}
        aria-label="Close wallet modal"
        className={cn(
          'p-1.5 text-[#777777] hover:text-white transition-colors duration-150',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]',
          isConnecting && 'opacity-40 cursor-not-allowed',
        )}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
