/**
 * @deprecated (#1044) — Moved to src/features/wallet/.
 *
 * This file is a re-export shim that keeps existing import paths working.
 * New code should import from '@/features/wallet' instead.
 *
 * Migration:
 *   Before: import { WalletModal } from '@/components/WalletModal'
 *   After:  import { WalletModal } from '@/features/wallet'
 *
 * Note (#1450, #1451): All user-facing strings and magic values are owned by
 * the underlying implementation in '@/features/wallet'. This shim intentionally
 * contains no hardcoded text or inline values; it only re-exports.
 *
 * Accessibility (#1434, #1435):
 *   Keyboard navigation and focus management (focus trap, initial focus,
 *   focus restoration on close, Escape-to-close, logical tab order) and
 *   ARIA labels/roles are implemented in the canonical component at
 *   '@/features/wallet'. This shim re-exports that implementation so all
 *   existing import paths inherit the accessible behavior.
 */
export { WalletModal, WALLET_OPTIONS } from '@/features/wallet';
export type { WalletModalProps, WalletOption } from '@/features/wallet';

export { WalletModal as default } from '@/features/wallet';
