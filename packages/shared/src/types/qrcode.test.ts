import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  QRCodeData,
  QRCodeOptions,
  GeneratedQRCode,
} from './qrcode';

describe('QRCode types', () => {
  it('QRCodeData has all required fields', () => {
    const data: QRCodeData = {
      transactionId: 'tx_001',
      amount: '100.00',
      currency: 'NGN',
      timestamp: Date.now(),
      status: 'complete',
    };
    expect(data.transactionId).toBe('tx_001');
    expectTypeOf(data.bankName).toMatchTypeOf<string | undefined>();
  });

  it('QRCodeOptions has all optional fields', () => {
    const opts: QRCodeOptions = {
      size: 256,
      errorCorrection: 'H',
      includeTransactionDetails: true,
    };
    expect(opts.size).toBe(256);
  });

  it('QRCodeOptions accepts valid error correction levels', () => {
    const levels: Array<'L' | 'M' | 'Q' | 'H'> = ['L', 'M', 'Q', 'H'];
    levels.forEach((level) => {
      const opts: QRCodeOptions = { errorCorrection: level };
      expect(opts.errorCorrection).toBe(level);
    });
  });

  it('GeneratedQRCode has all required fields', () => {
    const qr: GeneratedQRCode = {
      id: 'qr_001',
      transactionId: 'tx_001',
      qrData: 'data:text/plain;base64,abc',
      format: 'svg',
      createdAt: Date.now(),
    };
    expect(qr.format).toBe('svg');
    expectTypeOf(qr.expiresAt).toMatchTypeOf<number | undefined>();
  });

  it('GeneratedQRCode accepts valid formats', () => {
    const formats: Array<'svg' | 'png' | 'dataurl'> = ['svg', 'png', 'dataurl'];
    formats.forEach((format) => {
      const qr: GeneratedQRCode = {
        id: 'qr_002',
        transactionId: 'tx_002',
        qrData: 'data',
        format,
        createdAt: Date.now(),
      };
      expect(qr.format).toBe(format);
    });
  });
});
