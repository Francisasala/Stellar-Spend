import { pool } from '../db/client';
import { logger } from '../logger';
import { signAsync, verifyAsync } from '@/lib/crypto/signature';

const NONCE_TTL_MS = 5 * 60 * 1000;
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

export interface VerificationOptions {
  timestamp?: string | null;
  nonce?: string | null;
  allowedSkewMs?: number;
}

export class WebhookSecurityError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
    super(message);
    this.name = 'WebhookSecurityError';
  }
}

export async function createNonceTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS webhook_nonces (
      nonce_key TEXT PRIMARY KEY,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
  try {
    await pool.query(sql);
  } catch (err) {
    throw new WebhookSecurityError('Failed to create webhook_nonces table', err);
  }
}

async function pruneExpiredNonces(): Promise<void> {
  try {
    await pool.query('DELETE FROM webhook_nonces WHERE expires_at <= NOW()');
  } catch {
  }
}

async function isReplay(nonceKey: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM webhook_nonces WHERE nonce_key = $1',
      [nonceKey],
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function markNonceUsed(nonceKey: string): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO webhook_nonces (nonce_key, expires_at) VALUES ($1, NOW() + make_interval(secs => $2)) ON CONFLICT DO NOTHING',
      [nonceKey, NONCE_TTL_MS / 1000],
    );
  } catch {
  }
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
  timestampHeader?: string | null,
  nonceHeader?: string | null,
): Promise<VerificationResult> {
  if (!signature) {
    logVerificationFailure('missing_signature', { timestampHeader, nonceHeader });
    return { valid: false, reason: 'Missing signature' };
  }

  const ok = await verifyAsync(rawBody, signature, secret, 'sha256', 'hex');
  if (!ok) {
    logVerificationFailure('signature_mismatch', { timestampHeader, nonceHeader });
    return { valid: false, reason: 'Invalid signature' };
  }

  if (timestampHeader) {
    const ts = parseInt(timestampHeader, 10);
    if (isNaN(ts)) {
      logVerificationFailure('invalid_timestamp', { timestampHeader, nonceHeader });
      return { valid: false, reason: 'Invalid timestamp' };
    }
    const skew = Math.abs(Date.now() - ts);
    if (skew > MAX_TIMESTAMP_SKEW_MS) {
      logVerificationFailure('timestamp_expired', { timestampHeader, nonceHeader, skewMs: skew });
      return { valid: false, reason: 'Timestamp too old or too far in the future' };
    }
  }

  await pruneExpiredNonces();
  const replayKey = nonceHeader ?? `${timestampHeader}:${signature.slice(0, 16)}`;
  if (await isReplay(replayKey)) {
    logVerificationFailure('replay_detected', { timestampHeader, nonceHeader });
    return { valid: false, reason: 'Replay attack detected' };
  }
  await markNonceUsed(replayKey);

  return { valid: true };
}

export async function verifyProviderSignature(
  rawBody: string,
  signature: string,
  secret: string,
  options: VerificationOptions = {},
): Promise<VerificationResult> {
  return verifyWebhookSignature(rawBody, signature, secret, options.timestamp, options.nonce);
}

export async function generateOutgoingSignature(
  payload: string,
  secret: string,
): Promise<string> {
  return signAsync(payload, secret, 'sha256', 'hex');
}

export async function buildSignedWebhookHeaders(
  payload: string,
  secret: string,
): Promise<Record<string, string>> {
  const timestamp = String(Date.now());
  const signature = await generateOutgoingSignature(`${timestamp}.${payload}`, secret);
  return {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': signature,
  };
}

export class WebhookSecurity {
  static verifyProviderSignature = verifyProviderSignature;
  static verifyWebhookSignature = verifyWebhookSignature;
  static generateOutgoingSignature = generateOutgoingSignature;
  static buildSignedWebhookHeaders = buildSignedWebhookHeaders;
  static createNonceTable = createNonceTable;
}

function logVerificationFailure(reason: string, context: Record<string, unknown>): void {
  logger.warn('webhook.verification_failed', { reason, ...context });
}
