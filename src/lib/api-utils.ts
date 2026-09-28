/**
 * Shared API utilities — server-side response envelope plus thin
 * backward-compatible wrappers around the single client-side HTTP
 * implementation in `@/lib/api/client`.
 *
 * All retry/timeout/error-mapping logic for client requests lives in
 * `@/lib/api/client`; this module no longer duplicates it. It exists so
 * existing callers of `apiRequest`/`apiGet`/`apiPost`/`apiPut`/`apiDelete`
 * with the legacy `ApiRequestOptions` shape keep working unchanged.
 */

import { NextResponse } from 'next/server';
import {
  apiGet as clientGet,
  apiPost as clientPost,
  apiPut as clientPut,
  apiDelete as clientDelete,
  type ApiRequestConfig,
} from './api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status?: string;
}

/** Standard success envelope returned by every API route. */
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiRequestOptions extends RequestInit {
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Server-side helpers
// ---------------------------------------------------------------------------

/**
 * Wrap a successful response payload in the canonical envelope.
 */
export function successResponse<T>(data: T, status = 200): NextResponse<SuccessEnvelope<T>> {
  const body: SuccessEnvelope<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body, { status });
}

// ---------------------------------------------------------------------------
// Client-side fetch helpers
//
// These delegate to `@/lib/api/client`'s single HTTP implementation
// (timeout/abort handling, JSON parsing, error normalization) instead of
// re-implementing it, translating the legacy `ApiRequestOptions` (a
// `RequestInit` extension) into `ApiRequestConfig`.
// ---------------------------------------------------------------------------

function toClientConfig(options?: ApiRequestOptions): ApiRequestConfig {
  if (!options) return {};
  const { timeout, headers, credentials, cache } = options;
  return {
    timeout,
    headers: headers as Record<string, string> | undefined,
    credentials,
    cache,
  };
}

/**
 * Make a GET request with error handling and timeout.
 * @deprecated Prefer `apiClient` from `@/lib/api/client` in new code.
 */
export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  return clientGet<T>(endpoint, toClientConfig(options));
}

export async function apiGet<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
  return clientGet<T>(endpoint, toClientConfig(options));
}

export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  return clientPost<T>(endpoint, body, toClientConfig(options));
}

export async function apiPut<T>(
  endpoint: string,
  body?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  return clientPut<T>(endpoint, body, toClientConfig(options));
}

export async function apiDelete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
  return clientDelete<T>(endpoint, toClientConfig(options));
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}
