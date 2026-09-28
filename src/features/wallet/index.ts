/**
 * #1044 — Wallet feature barrel
 *
 * Public API surface for the wallet feature.  Import from this barrel
 * instead of reaching into sub-paths:
 *
 *   ✅  import { WalletModal, useStellarWallet } from '@/features/wallet'
 *   ❌  import { WalletModal } from '@/features/wallet/components/WalletModal'
 *
 * This barrel is the sole public contract.  Internal re-organisations
 * (file renames, sub-directory restructuring) stay invisible to consumers.
 */

// --- Components ---
export { WalletModal, WALLET_OPTIONS } from './components/WalletModal';
export type { WalletModalProps, WalletOption } from './components/modal/types';
export { WalletModalHeader } from './components/modal/WalletModalHeader';
export { WalletModalError } from './components/modal/WalletModalError';
export { WalletOptionButton } from './components/modal/WalletOptionButton';

// --- Context ---
// Aggregate (backward-compatible)
export { WalletProvider, useWalletContext } from './context/WalletContext';
export type { WalletContextValue } from './context/WalletContext';
// Narrower context hooks (#1184)
export { useWalletConnection, useWalletAccount, useWalletTransactionsContext } from './context/WalletContext';
export type {
  WalletConnectionContextValue,
  WalletAccountContextValue,
  WalletTransactionsContextValue,
} from './context/WalletContext';

// --- Hooks ---
export { useStellarWallet } from './hooks/useStellarWallet';
export type { WalletState, WalletSettings } from './hooks/useStellarWallet';
export { useWalletFlow } from './hooks/useWalletFlow';
export { useWalletTransactions } from './hooks/useWalletTransactions';
export type { WalletTransactions } from './hooks/useWalletTransactions';
