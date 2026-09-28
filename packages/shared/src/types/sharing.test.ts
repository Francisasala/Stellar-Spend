import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  ShareableTransaction,
  SharePreview,
  ShareSettings,
  SharePlatform,
} from './sharing';

describe('Sharing types', () => {
  it('ShareableTransaction has all required fields', () => {
    const tx: ShareableTransaction = {
      id: 'share_001',
      transactionId: 'tx_001',
      shareToken: 'tok_abc123',
      userAddress: 'GBXXXX',
      isPublic: true,
      createdAt: Date.now(),
      viewCount: 0,
    };
    expect(tx.isPublic).toBe(true);
    expectTypeOf(tx.expiresAt).toMatchTypeOf<number | undefined>();
  });

  it('SharePreview has all required fields', () => {
    const preview: SharePreview = {
      transactionId: 'tx_001',
      amount: '100.00',
      currency: 'NGN',
      status: 'complete',
      timestamp: Date.now(),
    };
    expect(preview.status).toBe('complete');
  });

  it('ShareSettings has all required fields', () => {
    const settings: ShareSettings = {
      allowSharing: true,
      shareableFields: ['amount', 'currency', 'status'],
    };
    expect(settings.allowSharing).toBe(true);
    expect(settings.shareableFields).toContain('amount');
    expectTypeOf(settings.expirationDays).toMatchTypeOf<number | undefined>();
  });

  it('ShareSettings with expiration', () => {
    const settings: ShareSettings = {
      allowSharing: true,
      shareableFields: ['amount'],
      expirationDays: 30,
    };
    expect(settings.expirationDays).toBe(30);
  });

  it('SharePlatform includes all valid platforms', () => {
    const platforms: SharePlatform[] = [
      'twitter',
      'facebook',
      'linkedin',
      'email',
      'copy',
    ];
    expect(platforms).toHaveLength(5);
  });
});
