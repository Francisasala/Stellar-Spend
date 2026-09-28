import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  WalletFlowState,
  RecentOfframpRow,
  ProgressStep,
  StateVariant,
  OfframpStep,
} from './stellaramp';

describe('StellarRamp types', () => {
  it('WalletFlowState includes all valid states', () => {
    const states: WalletFlowState[] = ['pre_connect', 'connecting', 'connected'];
    expect(states).toHaveLength(3);
  });

  it('OfframpStep includes all valid steps', () => {
    const steps: OfframpStep[] = [
      'idle',
      'initiating',
      'awaiting-signature',
      'submitting',
      'processing',
      'settling',
      'success',
      'error',
    ];
    expect(steps).toHaveLength(8);
  });

  it('RecentOfframpRow has all required fields', () => {
    const row: RecentOfframpRow = {
      txHash: '0xabc123',
      usdc: '100.00',
      fiat: '159800',
      currency: 'NGN',
      status: 'SETTLING',
    };
    expect(row.status).toBe('SETTLING');
  });

  it('RecentOfframpRow accepts COMPLETE status', () => {
    const row: RecentOfframpRow = {
      txHash: '0xdef456',
      usdc: '50.00',
      fiat: '79900',
      currency: 'NGN',
      status: 'COMPLETE',
    };
    expect(row.status).toBe('COMPLETE');
  });

  it('ProgressStep has all required fields', () => {
    const step: ProgressStep = {
      id: 'step_1',
      number: '1',
      title: 'Connect Wallet',
      description: 'Connect your Stellar wallet',
    };
    expect(step.id).toBe('step_1');
  });

  it('StateVariant has all required fields', () => {
    const variant: StateVariant = {
      key: 'pre_connect',
      subtitle: 'Connect your wallet',
      chipText: 'Not connected',
      formTitle: 'Get Started',
      formDescription: 'Connect to begin',
      walletStatus: 'Disconnected',
      walletStatusTone: 'muted',
      cta: 'Connect Wallet',
      ctaTone: 'accent',
      heroLabel: 'Off-Ramp',
      heroValue: '--',
      heroMeta: '',
      stepTwoTitle: 'Review',
      stepTwoDescription: 'Review your transaction',
      stepOneTitle: 'Connect',
      stepOneDescription: 'Connect your wallet',
    };
    expect(variant.key).toBe('pre_connect');
    expect(variant.walletStatusTone).toBe('muted');
    expect(variant.ctaTone).toBe('accent');
    expectTypeOf(variant.pulse).toMatchTypeOf<boolean | undefined>();
  });

  it('StateVariant accepts all valid tones', () => {
    const walletTones: Array<'muted' | 'accent'> = ['muted', 'accent'];
    const ctaTones: Array<'accent' | 'disabled' | 'light'> = [
      'accent',
      'disabled',
      'light',
    ];
    walletTones.forEach((tone) => {
      expect(['muted', 'accent']).toContain(tone);
    });
    ctaTones.forEach((tone) => {
      expect(['accent', 'disabled', 'light']).toContain(tone);
    });
  });
});
