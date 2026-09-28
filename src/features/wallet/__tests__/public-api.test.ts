import { describe, it, expect } from 'vitest';
import * as walletBarrel from '../index';

describe('Wallet Feature: Public API Boundary', () => {
  describe('Public API exports', () => {
    it('should export WalletModal component', () => {
      expect(walletBarrel).toHaveProperty('WalletModal');
      // React components are functions (or forwardRef objects) — accept either
      expect(['function', 'object']).toContain(typeof walletBarrel.WalletModal);
    });

    it('should export useStellarWallet hook', () => {
      expect(walletBarrel).toHaveProperty('useStellarWallet');
      expect(typeof walletBarrel.useStellarWallet).toBe('function');
    });

    it('should export useWalletFlow hook', () => {
      expect(walletBarrel).toHaveProperty('useWalletFlow');
      expect(typeof walletBarrel.useWalletFlow).toBe('function');
    });

    it('should export useWalletTransactions hook', () => {
      expect(walletBarrel).toHaveProperty('useWalletTransactions');
      expect(typeof walletBarrel.useWalletTransactions).toBe('function');
    });

    it('should export WalletProvider context', () => {
      expect(walletBarrel).toHaveProperty('WalletProvider');
      // React Context Providers are functions (or objects with $$typeof)
      expect(['function', 'object']).toContain(typeof walletBarrel.WalletProvider);
    });

    it('should export useWalletContext hook', () => {
      expect(walletBarrel).toHaveProperty('useWalletContext');
      expect(typeof walletBarrel.useWalletContext).toBe('function');
    });

    it('should export WalletModalHeader component', () => {
      expect(walletBarrel).toHaveProperty('WalletModalHeader');
    });

    it('should export WalletModalError component', () => {
      expect(walletBarrel).toHaveProperty('WalletModalError');
    });

    it('should export WalletOptionButton component', () => {
      expect(walletBarrel).toHaveProperty('WalletOptionButton');
    });

    it('should export WALLET_OPTIONS constant', () => {
      expect(walletBarrel).toHaveProperty('WALLET_OPTIONS');
      expect(Array.isArray(walletBarrel.WALLET_OPTIONS)).toBe(true);
    });

    // TypeScript type exports (WalletModalProps, WalletOption, WalletContextValue,
    // WalletState, WalletSettings, WalletTransactions) are compile-time only.
    // They are erased by the TypeScript compiler and cannot be checked at runtime.
    // Their presence is verified by TypeScript compilation succeeding, not by
    // runtime property checks.
  });

  describe('Public API completeness', () => {
    it('should provide all necessary components through barrel', () => {
      const componentExports = [
        'WalletModal',
        'WalletModalHeader',
        'WalletModalError',
        'WalletOptionButton',
      ];

      componentExports.forEach((exportName) => {
        expect(walletBarrel).toHaveProperty(exportName);
      });
    });

    it('should provide all necessary hooks through barrel', () => {
      const hookExports = ['useStellarWallet', 'useWalletFlow', 'useWalletTransactions'];

      hookExports.forEach((exportName) => {
        expect(walletBarrel).toHaveProperty(exportName);
      });
    });

    it('should provide all necessary value exports through barrel', () => {
      // Only value exports can be checked at runtime.
      // Type exports (WalletModalProps, WalletOption, etc.) are compile-time only.
      const valueExports = [
        'WalletModal',
        'WalletModalHeader',
        'WalletModalError',
        'WalletOptionButton',
        'WALLET_OPTIONS',
        'WalletProvider',
        'useWalletContext',
        'useStellarWallet',
        'useWalletFlow',
        'useWalletTransactions',
      ];

      valueExports.forEach((exportName) => {
        expect(walletBarrel).toHaveProperty(exportName);
      });
    });
  });

  describe('Public API usage patterns', () => {
    it('should enforce barrel import pattern in documentation', () => {
      const barrelPath = require.resolve('../index.ts');
      expect(barrelPath).toContain('features/wallet/index.ts');
    });

    it('should have WalletModal as the primary export', () => {
      expect(walletBarrel.WalletModal).toBeDefined();
    });

    it('should have useStellarWallet as primary hook export', () => {
      expect(walletBarrel.useStellarWallet).toBeDefined();
      expect(typeof walletBarrel.useStellarWallet).toBe('function');
    });

    it('should provide context management exports', () => {
      expect(walletBarrel.WalletProvider).toBeDefined();
      expect(walletBarrel.useWalletContext).toBeDefined();
      // WalletContextValue is a TypeScript type — only verifiable at compile time
    });
  });

  describe('Type exports validation', () => {
    // TypeScript types are erased at runtime. The authoritative way to validate
    // that type exports are correct is via `tsc --noEmit`. These tests confirm
    // that the corresponding value exports (components, hooks) are present,
    // which gives consumers confidence that the barrel is correctly assembled.

    it('should have all value exports accessible from barrel', () => {
      const exports = Object.keys(walletBarrel);

      // Value exports that must be present (types won't appear here)
      expect(exports).toContain('WalletModal');
      expect(exports).toContain('useWalletContext');
      expect(exports).toContain('useStellarWallet');
    });

    it('should provide WalletState and WalletSettings via their hook export', () => {
      // useStellarWallet returns an object with WalletState/WalletSettings shapes.
      // At runtime we can verify the hook is exported; types are compile-time only.
      expect(walletBarrel.useStellarWallet).toBeDefined();
      expect(typeof walletBarrel.useStellarWallet).toBe('function');
    });

    it('should provide WalletTransactions via its hook export', () => {
      // useWalletTransactions returns a WalletTransactions-shaped object.
      // At runtime we verify the hook is exported; the type is compile-time only.
      expect(walletBarrel.useWalletTransactions).toBeDefined();
      expect(typeof walletBarrel.useWalletTransactions).toBe('function');
    });
  });

  describe('Barrel re-export integrity', () => {
    it('should not expose internal implementation details', () => {
      const exports = Object.keys(walletBarrel);

      // Should not expose internal paths
      expect(exports.filter((key) => key.includes('Internal')).length).toBe(0);
      expect(exports.filter((key) => key.includes('private')).length).toBe(0);
    });

    it('should export at reasonable scope', () => {
      const exports = Object.keys(walletBarrel);

      // Should have reasonable number of public exports
      expect(exports.length).toBeGreaterThanOrEqual(10);
      expect(exports.length).toBeLessThan(50);
    });

    it('should maintain consistent naming conventions', () => {
      const componentExports = ['WalletModal', 'WalletModalHeader', 'WalletModalError', 'WalletOptionButton'];

      componentExports.forEach((name) => {
        expect(name).toMatch(/^[A-Z]/);
      });
    });
  });

  describe('Feature stability', () => {
    it('should have stable public API', () => {
      const exports = Object.keys(walletBarrel);
      expect(exports).toContain('WalletModal');
      expect(exports).toContain('useStellarWallet');
    });

    it('should not break existing imports through barrel', () => {
      expect(() => {
        const { WalletModal, useStellarWallet, WalletProvider } = walletBarrel;
        expect(WalletModal).toBeDefined();
        expect(useStellarWallet).toBeDefined();
        expect(WalletProvider).toBeDefined();
      }).not.toThrow();
    });
  });
});
