'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/Icon';
import type { WalletType } from '@/lib/stellar';
import type { WalletOption } from './types';

export interface WalletOptionButtonProps {
  wallet: WalletOption;
  isConnecting: boolean;
  connectingWallet: WalletType | null;
  onConnect: (walletType: WalletType) => void;
}

export const WalletOptionButton = forwardRef<HTMLButtonElement, WalletOptionButtonProps>(
  function WalletOptionButton(
    { wallet, isConnecting, connectingWallet, onConnect },
    ref,
  ) {
    const isThisConnecting = isConnecting && connectingWallet === wallet.type;
    const isOtherConnecting = isConnecting && connectingWallet !== wallet.type;

    return (
      <button
        ref={ref}
        onClick={() => onConnect(wallet.type)}
        disabled={isConnecting}
        aria-label={`Connect with ${wallet.name}`}
        aria-busy={isThisConnecting}
        data-testid={`wallet-option-${wallet.type}`}
        className={cn(
          'flex items-center gap-4 w-full px-4 py-4 border text-left',
          'transition-all duration-150',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]',
          isThisConnecting
            ? 'border-[#c9a962] bg-[#c9a962]/10 animate-pulse'
            : isOtherConnecting
              ? 'border-[#222222] bg-[#0a0a0a] opacity-40 cursor-not-allowed'
              : 'border-[#333333] bg-[#0a0a0a] hover:border-[#c9a962]/60 hover:bg-[#c9a962]/5',
        )}
      >
        <div className="shrink-0">{wallet.icon}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white tracking-wide">
              {wallet.name}
            </span>
            {isThisConnecting && (
              <span className="text-[10px] text-[#c9a962] tracking-widest uppercase animate-pulse">
                Connecting…
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#777777] mt-0.5 leading-relaxed">
            {wallet.description}
          </p>
        </div>

        {!isThisConnecting && (
          <Icon name="chevron-right" size={16} className="shrink-0 text-[#555555]" />
        )}
      </button>
    );
  },
);
