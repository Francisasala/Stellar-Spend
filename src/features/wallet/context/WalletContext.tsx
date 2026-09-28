'use client';

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// #1184 — Split wallet context into three narrower contexts
// #1183 — Memoize context values and callbacks to prevent broad re-renders
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. WalletConnectionContext  — connection lifecycle (isConnected, isConnecting,
//    onConnect, onDisconnect).  Components that only need to show a
//    "Connect" button subscribe here and never re-render when the address
//    changes.
// ---------------------------------------------------------------------------

export interface WalletConnectionContextValue {
  /** Whether the wallet is currently connected */
  isConnected: boolean;
  /** Whether a connection attempt is in progress */
  isConnecting: boolean;
  /** Trigger a wallet connection flow */
  onConnect: () => void;
  /** Disconnect the wallet */
  onDisconnect: () => void;
}

const WalletConnectionContext =
  createContext<WalletConnectionContextValue | null>(null);

export function useWalletConnection(): WalletConnectionContextValue {
  const ctx = useContext(WalletConnectionContext);
  if (!ctx) {
    throw new Error('useWalletConnection must be used within a <WalletProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// 2. WalletAccountContext  — account identity (walletAddress, walletType).
//    Components that display the connected address subscribe here and are
//    only re-rendered when the account identity changes.
// ---------------------------------------------------------------------------

export interface WalletAccountContextValue {
  /** The connected wallet address, if any */
  walletAddress?: string;
  /** The type of connected wallet */
  walletType?: 'Freighter' | 'Lobstr' | null;
}

const WalletAccountContext =
  createContext<WalletAccountContextValue | null>(null);

export function useWalletAccount(): WalletAccountContextValue {
  const ctx = useContext(WalletAccountContext);
  if (!ctx) {
    throw new Error('useWalletAccount must be used within a <WalletProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// 3. WalletTransactionsContext  — transactions slice.  Reserved for future
//    use when live balance / tx-list data is lifted into context.
// ---------------------------------------------------------------------------

export interface WalletTransactionsContextValue {
  /** Placeholder — extend with balances / transactions as needed */
  _reserved: true;
}

const WalletTransactionsContext =
  createContext<WalletTransactionsContextValue | null>(null);

export function useWalletTransactionsContext(): WalletTransactionsContextValue {
  const ctx = useContext(WalletTransactionsContext);
  if (!ctx) {
    throw new Error(
      'useWalletTransactionsContext must be used within a <WalletProvider>',
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Backward-compatible aggregate type & hook — consumers that need everything
// in one shot (e.g. form pages that read address AND trigger a connect flow)
// can continue using useWalletContext() without changes.
// ---------------------------------------------------------------------------

export interface WalletContextValue
  extends WalletConnectionContextValue,
    WalletAccountContextValue {}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Access the full wallet context.
 *
 * Prefer the narrower hooks (useWalletConnection, useWalletAccount) when a
 * component only needs a subset of the context — this avoids subscribing to
 * changes that the component doesn't care about.
 *
 * Must be used within a <WalletProvider>.
 */
export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWalletContext must be used within a <WalletProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// WalletProvider — composes all three narrower providers.
//
// Internally splits the incoming `value` into three memoized slices so that:
//   • a change to walletAddress only re-renders account-context consumers
//   • a change to isConnecting only re-renders connection-context consumers
//   • the transactions slice is completely independent
// ---------------------------------------------------------------------------

export function WalletProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: WalletContextValue;
}) {
  const {
    isConnected,
    isConnecting,
    walletAddress,
    walletType,
    onConnect,
    onDisconnect,
  } = value;

  // Stable callback references so consumers don't re-render just because the
  // parent re-renders with a new function literal.
  const stableConnect = useCallback(onConnect, [onConnect]); // eslint-disable-line react-hooks/exhaustive-deps
  const stableDisconnect = useCallback(onDisconnect, [onDisconnect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Narrow slice: connection lifecycle
  const connectionValue = useMemo<WalletConnectionContextValue>(
    () => ({
      isConnected,
      isConnecting,
      onConnect: stableConnect,
      onDisconnect: stableDisconnect,
    }),
    [isConnected, isConnecting, stableConnect, stableDisconnect],
  );

  // Narrow slice: account identity
  const accountValue = useMemo<WalletAccountContextValue>(
    () => ({ walletAddress, walletType }),
    [walletAddress, walletType],
  );

  // Narrow slice: transactions (currently a placeholder)
  const transactionsValue = useMemo<WalletTransactionsContextValue>(
    () => ({ _reserved: true }),
    [],
  );

  // Full aggregate value for backward-compat consumers
  const fullValue = useMemo<WalletContextValue>(
    () => ({
      isConnected,
      isConnecting,
      walletAddress,
      walletType,
      onConnect: stableConnect,
      onDisconnect: stableDisconnect,
    }),
    [
      isConnected,
      isConnecting,
      walletAddress,
      walletType,
      stableConnect,
      stableDisconnect,
    ],
  );

  return (
    <WalletContext.Provider value={fullValue}>
      <WalletConnectionContext.Provider value={connectionValue}>
        <WalletAccountContext.Provider value={accountValue}>
          <WalletTransactionsContext.Provider value={transactionsValue}>
            {children}
          </WalletTransactionsContext.Provider>
        </WalletAccountContext.Provider>
      </WalletConnectionContext.Provider>
    </WalletContext.Provider>
  );
}
