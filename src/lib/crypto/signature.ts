/**
 * Shared HMAC signature primitives used by both outbound request signing
 * (src/lib/request-signing.ts) and inbound webhook verification
 * (src/lib/webhook/security.ts).
 *
 * Provides:
 *   - sync sign/verify via Node's createHmac (works in Node runtime)
 *   - async sign/verify via Web Crypto subtle (works in Edge runtime too)
 *   - constant-time comparison on both paths
 *
 * Closes #1205
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export type HmacAlgorithm = 'sha256' | 'sha512';
export type HmacEncoding = 'hex' | 'base64';

/* -------------------------------------------------------------------------
 * Sync (Node runtime)
 * ----------------------------------------------------------------------- */

export function sign(
  payload: string | Buffer,
  secret: string,
  algorithm: HmacAlgorithm = 'sha256',
  encoding: HmacEncoding = 'hex',
): string {
  if (!secret) throw new Error('signature.sign: secret is required');
  return createHmac(algorithm, secret).update(payload).digest(encoding);
}

export function verify(
  payload: string | Buffer,
  signature: string,
  secret: string,
  algorithm: HmacAlgorithm = 'sha256',
  encoding: HmacEncoding = 'hex',
): boolean {
  if (!secret || !signature) return false;
  let expected: string;
  try {
    expected = sign(payload, secret, algorithm, encoding);
  } catch {
    return false;
  }
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/* -------------------------------------------------------------------------
 * Async (Web Crypto — Edge-compatible)
 * ----------------------------------------------------------------------- */

export async function signAsync(
  payload: string,
  secret: string,
  algorithm: HmacAlgorithm = 'sha256',
  encoding: HmacEncoding = 'hex',
): Promise<string> {
  if (!secret) throw new Error('signature.signAsync: secret is required');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: algorithm === 'sha512' ? 'SHA-512' : 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const bytes = new Uint8Array(mac);
  if (encoding === 'base64') {
    return Buffer.from(bytes).toString('base64');
  }
  return Buffer.from(bytes).toString('hex');
}

export async function verifyAsync(
  payload: string,
  signature: string,
  secret: string,
  algorithm: HmacAlgorithm = 'sha256',
  encoding: HmacEncoding = 'hex',
): Promise<boolean> {
  if (!secret || !signature) return false;
  let expected: string;
  try {
    expected = await signAsync(payload, secret, algorithm, encoding);
  } catch {
    return false;
  }
  // Constant-time compare on the string bytes.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
