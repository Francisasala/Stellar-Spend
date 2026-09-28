'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useFocusTrap, useFocusRestore } from '@/hooks/useFocusTrap';
import {
  type WalletModalProps,
  type WalletOption,
} from './modal/types';
import { WalletOptionButton } from './modal/WalletOptionButton';
import { WalletModalHeader } from './modal/WalletModalHeader';
import { WalletModalError } from './modal/WalletModalError';

export * from './modal/types';

export const WALLET_OPTIONS: WalletOption[] = [
  {
    type: 'freighter',
    name: 'Freighter',
    description: 'Official Stellar browser extension wallet',
    installUrl: 'https://www.freighter.app/',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#5B4FE9" />
        <path
          d="M8 16C8 11.582 11.582 8 16 8C20.418 8 24 11.582 24 16C24 20.418 20.418 24 16 24"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M16 12V16L19 19"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="22" r="2" fill="white" />
      </svg>
    ),
  },
  {
    type: 'lobstr',
    name: 'LOBSTR',
    description: 'Popular Stellar wallet with mobile & browser support',
    installUrl: 'https://lobstr.co/',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1A1A2E" />
        <path
          d="M16 6L26 11V21L16 26L6 21V11L16 6Z"
          stroke="#00D4FF"
          strokeWidth="1.5"
          fill="none"
        />
        <path d="M16 10L22 13.5V20.5L16 24L10 20.5V13.5L16 10Z" fill="#00D4FF" fillOpacity="0.2" />
        <circle cx="16" cy="17" r="3" fill="#00D4FF" />
      </svg>
    ),
  },
];

export function WalletModal({
  isOpen,
  isConnecting,
  connectingWallet,
  error,
  onConnect,
  onClose,
}: WalletModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const [dismissed, setDismissed] = useState(false);

  useFocusTrap(overlayRef, isOpen);
  useFocusRestore(isOpen);

  useEffect(() => {
    if (isOpen) {
      setDismissed(false);
      setTimeout(() => firstButtonRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConnecting) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isConnecting, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !isConnecting) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
      data-testid="wallet-modal"
    >
      <div className="relative w-full max-w-sm mx-4 bg-[#111111] border border-[#333333] shadow-2xl">
        <WalletModalHeader isConnecting={isConnecting} onClose={onClose} />

        <div className="p-4 flex flex-col gap-3">
          {WALLET_OPTIONS.map((wallet, i) => (
            <WalletOptionButton
              key={wallet.type}
              ref={i === 0 ? firstButtonRef : undefined}
              wallet={wallet}
              isConnecting={isConnecting}
              connectingWallet={connectingWallet}
              onConnect={onConnect}
            />
          ))}
        </div>

        {error && !dismissed && (
          <WalletModalError error={error} onDismiss={() => setDismissed(true)} />
        )}

        <div className="px-6 py-4 border-t border-[#222222] flex items-center justify-between">
          <p className="text-[10px] text-[#555555] tracking-wide">Don&apos;t have a wallet?</p>
          <div className="flex gap-3">
            {WALLET_OPTIONS.map((w) => (
              <a
                key={w.type}
                href={w.installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'text-[10px] tracking-widest uppercase text-[#c9a962]',
                  'hover:underline focus:outline-none focus-visible:underline',
                )}
                aria-label={`Install ${w.name}`}
              >
                Get {w.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WalletModal;
