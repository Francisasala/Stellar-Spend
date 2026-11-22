'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { bpClasses } from '@/lib/breakpoints';
import { Skeleton } from '@/components/ui';
import { ThemeToggle } from './ThemeToggle';
import { CopyButton } from './CopyButton';
import { WalletModal } from './WalletModal';
import { LanguageSelector } from '@/lib/i18n/LanguageSelector';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { NotificationCenter } from './NotificationCenter';
import { useFxRate } from '@/hooks/useFxRate';
import { useNotificationEvents } from '@/contexts/NotificationProvider';
import type { WalletType } from '@/lib/stellar';
import { formatNumber } from '@/lib/format';

/** Minimum length before a wallet address is truncated for display. */
const ADDRESS_TRUNCATE_THRESHOLD = 10;
/** Number of leading characters kept when truncating a wallet address. */
const ADDRESS_LEADING_CHARS = 4;
/** Number of trailing characters kept when truncating a wallet address. */
const ADDRESS_TRAILING_CHARS = 4;
/** SVG icon size (px) for the help button. */
const HELP_ICON_SIZE = 20;
/** SVG viewBox for the help icon. */
const HELP_ICON_VIEWBOX = '0 0 24 24';
/** SVG stroke width for the help icon. */
const HELP_ICON_STROKE_WIDTH = 2;
/** Circle radius for the help icon. */
const HELP_ICON_CIRCLE_RADIUS = 12;
/** Placeholder shown when a value is unavailable. */
const EMPTY_VALUE_PLACEHOLDER = '—';
/** Keyboard shortcut hint for the help button. */
const HELP_SHORTCUT = 'Shift + ?';
/** Keyboard shortcut for copying the wallet address. */
const COPY_WALLET_SHORTCUT = 'w';

export interface HeaderProps {
  subtitle: string;
  isConnected: boolean;
  isConnecting: boolean;
  walletAddress?: string;
  walletType?: 'Freighter' | 'Lobstr' | null;
  stellarUsdcBalance?: string | null;
  stellarXlmBalance?: string | null;
  isBalanceLoading?: boolean;
  walletError?: string | null;
  onConnect: (walletType?: WalletType) => void;
  onDisconnect: () => void;
  onHelpOpen?: () => void;
  /** Called with the openModal function so parent can trigger the modal */
  onModalRef?: (openModal: () => void) => void;
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function truncateAddress(address: string): string {
  if (address.length <= ADDRESS_TRUNCATE_THRESHOLD) return address;
  return `${address.slice(0, ADDRESS_LEADING_CHARS)}...${address.slice(-ADDRESS_TRAILING_CHARS)}`;
}

const WalletButton = memo(function WalletButton({
  isConnected,
  isConnecting,
  walletAddress,
  walletType,
  onOpenModal,
  onDisconnect,
  t,
}: {
  isConnected: boolean;
  isConnecting: boolean;
  walletAddress?: string;
  walletType?: 'Freighter' | 'Lobstr' | null;
  onOpenModal: () => void;
  onDisconnect: () => void;
  t: TranslateFn;
}) {
  const label = useMemo(
    () =>
      isConnecting
        ? t('header.wallet.connecting')
        : isConnected && walletAddress
          ? truncateAddress(walletAddress)
          : t('header.wallet.connect'),
    [isConnecting, isConnected, walletAddress, t],
  );

  const disabled = isConnecting;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isConnected && walletType && (
        <span className={`text-xs text-slate-500 tracking-widest ${bpClasses.hiddenBelowSm}`}>
          {walletType.toUpperCase()}
        </span>
      )}
      {isConnected && walletAddress && (
        <CopyButton
          text={walletAddress}
          label=""
          className="text-xs"
          keyboardShortcut={COPY_WALLET_SHORTCUT}
        />
      )}
      <button
        type="button"
        onClick={isConnected ? onDisconnect : onOpenModal}
        disabled={disabled}
        aria-label={
          isConnected ? t('header.wallet.disconnectAria') : t('header.wallet.connectAria')
        }
        aria-busy={isConnecting}
        aria-haspopup={isConnected ? undefined : 'dialog'}
        aria-expanded={isConnected ? undefined : undefined}
        data-testid={isConnected ? 'wallet-button' : 'connect-wallet-button'}
        className={cn(
          'px-4 py-2 min-h-[44px] text-xs tracking-widest border transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a962] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
          'border-[#c9a962] bg-[#0a0a0a] text-[#c9a962]',
          !disabled && 'hover:bg-[#c9a962] hover:text-[#0a0a0a]',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {label}
      </button>
    </div>
  );
});

export const Header = memo(function Header({
  subtitle,
  isConnected,
  isConnecting,
  walletAddress,
  walletType,
  stellarUsdcBalance,
  stellarXlmBalance,
  isBalanceLoading,
  walletError,
  onConnect,
  onDisconnect,
  onHelpOpen,
  onModalRef,
}: HeaderProps) {
  const { t } = useTranslation();
  const { rate, flash } = useFxRate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<WalletType | null>(null);
  const [isHelpActive, setIsHelpActive] = useState(false);

  // Load notifications from the unified NotificationProvider (#1042)
  const notificationCenter = useNotificationEvents();

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleHelpOpen = () => {
    setIsHelpActive(true);
    onHelpOpen?.();
  };

  // Expose openModal to parent via callback ref
  useEffect(() => {
    onModalRef?.(handleOpenModal);
  }, [onModalRef, handleOpenModal]);

  const handleCloseModal = useCallback(() => {
    if (!isConnecting) setIsModalOpen(false);
  }, [isConnecting]);

  const handleConnectWallet = useCallback(
    async (walletType: WalletType) => {
      setConnectingWallet(walletType);
      await onConnect(walletType);
      setConnectingWallet(null);
      // Close modal on success (no error)
      if (!walletError) setIsModalOpen(false);
    },
    [onConnect, walletError],
  );

  // Close modal when connection succeeds
  useEffect(() => {
    if (isConnected && isModalOpen) {
      setIsModalOpen(false);
    }
  }, [isConnected, isModalOpen]);

  const usdcBalanceText = useMemo(() => `${stellarUsdcBalance ?? '—'} USDC`, [stellarUsdcBalance]);
  const xlmBalanceText = useMemo(() => `${stellarXlmBalance ?? '—'} XLM`, [stellarXlmBalance]);

  return (
    <>
      <header
        className={cn(
          'w-full px-6 py-5 flex items-start justify-between gap-6',
          bpClasses.headerCollapseFlexCol,
          bpClasses.headerCollapseItemsStart,
        )}
        role="banner"
      >
        {/* Left: title + subtitle + FX chip */}
        <div className="flex flex-col gap-1">
          <h1 className="font-space-grotesk font-bold text-white leading-none tracking-tight text-[clamp(1.5rem,4vw,2.5rem)]">
            {t('header.title')}
          </h1>
          <p className="text-xs text-[#777777] tracking-widest uppercase">{subtitle}</p>
          <span
            aria-live="polite"
            aria-label={t('header.fxRateAria')}
            className={cn(
              'mt-1 inline-block self-start px-2 py-0.5 text-[10px] tracking-widest uppercase border border-[#c9a962]/40 text-[#c9a962] transition-colors duration-300',
              flash && 'bg-[#c9a962]/20',
            )}
          >
            {rate != null
              ? t('header.fxRate', { rate: formatNumber(Math.round(rate)) })
              : t('header.fxRateUnavailable', { placeholder: EMPTY_VALUE_PLACEHOLDER })}
          </span>
        </div>

        {/* Right: notifications + wallet button + balances */}
        <div className={cn('flex flex-col items-end gap-2', bpClasses.headerCollapseItemsStart)}>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button
              type="button"
              onClick={handleHelpOpen}
              aria-label={t('header.helpAria')}
              aria-current={isHelpActive ? 'page' : undefined}
              className={cn(
                'p-2 text-[#777777] hover:text-[#c9a962] transition-colors',
                'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]',
              )}
              title={t('header.helpTitle', { shortcut: HELP_SHORTCUT })}
            >
              <svg
                width={HELP_ICON_SIZE}
                height={HELP_ICON_SIZE}
                viewBox={HELP_ICON_VIEWBOX}
                fill="none"
                stroke="currentColor"
                strokeWidth={HELP_ICON_STROKE_WIDTH}
                aria-hidden="true"
                focusable="false"
              >
                <circle
                  cx={HELP_ICON_CIRCLE_RADIUS}
                  cy={HELP_ICON_CIRCLE_RADIUS}
                  r={HELP_ICON_CIRCLE_RADIUS - 2}
                ></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
            </button>
            <ThemeToggle />
            {isConnected && (
              <NotificationCenter
                events={notificationCenter.events}
                unreadCount={notificationCenter.unreadCount}
                unreadBadgeText={notificationCenter.unreadBadgeText}
                loading={notificationCenter.loading}
                onMarkAsRead={notificationCenter.markAsRead}
                onMarkAllAsRead={notificationCenter.markAllAsRead}
                onRemoveEvent={notificationCenter.removeEvent}
                onClearAll={notificationCenter.clearAll}
              />
            )}
            <WalletButton
              isConnected={isConnected}
              isConnecting={isConnecting}
              walletAddress={walletAddress}
              walletType={walletType}
              onOpenModal={handleOpenModal}
              onDisconnect={onDisconnect}
              t={t}
            />
          </div>

          {isConnected && (
            <div
              className={cn('flex flex-col items-end gap-0.5', bpClasses.headerCollapseItemsStart)}
              data-testid="header-balances"
            >
              {isBalanceLoading ? (
                <div className="flex flex-col items-end gap-0.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ) : (
                <>
                  <span className="text-xs text-[#c9a962] tracking-wider">
                    {t('header.balances.usdc', {
                      amount: stellarUsdcBalance ?? EMPTY_VALUE_PLACEHOLDER,
                    })}
                  </span>
                  <span className="text-xs text-[#777777] tracking-wider">
                    {t('header.balances.xlm', {
                      amount: stellarXlmBalance ?? EMPTY_VALUE_PLACEHOLDER,
                    })}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Wallet selection modal */}
      <WalletModal
        isOpen={isModalOpen}
        isConnecting={isConnecting}
        connectingWallet={connectingWallet}
        error={walletError ?? null}
        onConnect={handleConnectWallet}
        onClose={handleCloseModal}
      />
    </>
  );
});
