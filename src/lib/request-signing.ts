/**
 * Request signing utilities for API authentication.
 * HMAC computation is delegated to the shared primitive in
 * src/lib/crypto/signature.ts (closes #1205).
 */

import { sign as _sign, safeCompare } from '@/lib/crypto/signature';

export interface SignatureConfig {
  algorithm: 'sha256' | 'sha512';
  encoding: 'hex' | 'base64';
  timestampTolerance: number; // milliseconds
}

export const DEFAULT_SIGNATURE_CONFIG: SignatureConfig = {
  algorithm: 'sha256',
  encoding: 'hex',
  timestampTolerance: 5 * 60 * 1000, // 5 minutes
};

export function generateSignature(
  method: string,
  path: string,
  body: string | null,
  timestamp: string,
  secret: string,
  config: SignatureConfig = DEFAULT_SIGNATURE_CONFIG,
): string {
  const message = [method, path, body || '', timestamp].join('\n');
  return _sign(message, secret, config.algorithm, config.encoding);
}

export function verifySignature(
  method: string,
  path: string,
  body: string | null,
  timestamp: string,
  signature: string,
  secret: string,
  config: SignatureConfig = DEFAULT_SIGNATURE_CONFIG,
): { valid: boolean; error?: string } {
  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();

  if (isNaN(requestTime)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }

  if (Math.abs(now - requestTime) > config.timestampTolerance) {
    return { valid: false, error: 'Request timestamp is too old or in the future' };
  }

  const expected = generateSignature(method, path, body, timestamp, secret, config);
  return safeCompare(expected, signature) ? { valid: true } : { valid: false };
}

/**
 * Extract signature from request headers
 */
export function extractSignatureFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): {
  signature?: string;
  timestamp?: string;
  error?: string;
} {
  const signature = headers['x-signature'] || headers['x-hmac-signature'];
  const timestamp = headers['x-timestamp'] || headers['x-request-timestamp'];

  if (!signature) {
    return { error: 'Missing signature header (x-signature or x-hmac-signature)' };
  }

  if (!timestamp) {
    return { error: 'Missing timestamp header (x-timestamp or x-request-timestamp)' };
  }

  return {
    signature: Array.isArray(signature) ? signature[0] : signature,
    timestamp: Array.isArray(timestamp) ? timestamp[0] : timestamp,
  };
}

export function generateTimestamp(): string {
  return Date.now().toString();
}

export function createSignedRequestHeaders(
  method: string,
  path: string,
  body: string | null,
  secret: string,
  config: SignatureConfig = DEFAULT_SIGNATURE_CONFIG,
): Record<string, string> {
  const timestamp = generateTimestamp();
  const signature = generateSignature(method, path, body, timestamp, secret, config);

  return {
    'x-signature': signature,
    'x-timestamp': timestamp,
  };
}

export function validateRequestSignature(
  method: string,
  path: string,
  body: string | null,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
  config: SignatureConfig = DEFAULT_SIGNATURE_CONFIG,
): { valid: boolean; error?: string } {
  const { signature, timestamp, error: extractError } = extractSignatureFromHeaders(headers);

  if (extractError) {
    return { valid: false, error: extractError };
  }

  if (!signature || !timestamp) {
    return { valid: false, error: 'Missing signature or timestamp' };
  }

  return verifySignature(method, path, body, timestamp, signature, secret, config);
}

export class ReplayAttackPrevention {
  private usedTimestamps = new Set<string>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private toleranceMs: number = 5 * 60 * 1000) {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  isReplay(timestamp: string): boolean {
    return this.usedTimestamps.has(timestamp);
  }

  recordTimestamp(timestamp: string): void {
    this.usedTimestamps.add(timestamp);
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.toleranceMs;
    for (const ts of this.usedTimestamps) {
      if (parseInt(ts, 10) < cutoff) this.usedTimestamps.delete(ts);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}