import type { ReactNode } from 'react';
import type { WalletType } from '@/lib/stellar';

export interface WalletModalProps {
  isOpen: boolean;
  isConnecting: boolean;
  connectingWallet: WalletType | null;
  error: string | null;
  onConnect: (walletType: WalletType) => void;
  onClose: () => void;
}

export interface WalletOption {
  type: WalletType;
  name: string;
  description: string;
  icon: ReactNode;
  installUrl: string;
}
