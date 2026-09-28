/**
 * Typed API client for all fetch requests to ensure consistent error handling,
 * request/response typing, and header management across the application.
 *
 * Single source of truth for client-side HTTP calls — see `apiClient` for the
 * ergonomic namespaced entry point, or use the individual `api*` helpers.
 */

import type { ApiError } from '@stellar-spend/shared';
export type { ApiResponse, ApiError } from '@stellar-spend/shared';

export class ApiErrorClass extends Error implements ApiError {
  constructor(
    public message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestConfig {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  credentials?: RequestCredentials;
  cache?: RequestCache;
}

/**
 * Normalize API errors into a consistent shape
 */
function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiErrorClass) {
    return error;
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      status: 500,
      details: error,
    };
  }

  return {
    message: 'An unexpected error occurred',
    status: 500,
    details: error,
  };
}

/** Minimal shape parseJsonResponse relies on — matches Response but also test doubles. */
interface JsonParsable {
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
}

/**
 * Parse JSON response body, falling back gracefully if JSON parsing fails.
 * Prefers `text()` (handles empty bodies cleanly); falls back to `json()`
 * for response-like objects that only implement that method.
 */
async function parseJsonResponse(response: JsonParsable): Promise<unknown> {
  if (typeof response.text !== 'function') {
    if (typeof response.json !== 'function') return undefined;
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  try {
    const text = await response.text();
    if (!text) return undefined;
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Core API request handler with consistent error handling and typing
 *
 * Usage:
 * const user = await apiRequest<User>('/api/users/123', { method: 'GET' });
 * const created = await apiPost<User>('/api/users', { name: 'John' });
 */
async function apiRequest<T = unknown>(url: string, config: ApiRequestConfig = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, timeout = 30000, credentials, cache } = config;

  const fetchInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (credentials) {
    fetchInit.credentials = credentials;
  }

  if (cache) {
    fetchInit.cache = cache;
  }

  if (body !== undefined) {
    fetchInit.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout);

    const response = await fetch(url, {
      ...fetchInit,
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await parseJsonResponse(response);

    if (!response.ok) {
      const errorMessage =
        (responseBody as any)?.error?.message ||
        (responseBody as any)?.error ||
        (typeof responseBody === 'string' ? responseBody : null) ||
        `Request failed with status ${response.status}`;

      throw new ApiErrorClass(errorMessage, response.status, responseBody);
    }

    return (responseBody as T) || ({} as T);
  } catch (error) {
    if (error instanceof ApiErrorClass) {
      throw error;
    }

    const normalized = normalizeError(error);
    throw new ApiErrorClass(normalized.message, normalized.status, normalized.details);
  }
}

/** Make a typed GET request */
export async function apiGet<T = unknown>(url: string, config?: ApiRequestConfig): Promise<T> {
  return apiRequest<T>(url, { ...config, method: 'GET' });
}

/** Make a typed POST request */
export async function apiPost<T = unknown>(
  url: string,
  body?: unknown,
  config?: ApiRequestConfig,
): Promise<T> {
  return apiRequest<T>(url, { ...config, method: 'POST', body });
}

/** Make a typed PATCH request */
export async function apiPatch<T = unknown>(
  url: string,
  body?: unknown,
  config?: ApiRequestConfig,
): Promise<T> {
  return apiRequest<T>(url, { ...config, method: 'PATCH', body });
}

/** Make a typed PUT request */
export async function apiPut<T = unknown>(
  url: string,
  body?: unknown,
  config?: ApiRequestConfig,
): Promise<T> {
  return apiRequest<T>(url, { ...config, method: 'PUT', body });
}

/** Make a typed DELETE request */
export async function apiDelete<T = unknown>(url: string, config?: ApiRequestConfig): Promise<T> {
  return apiRequest<T>(url, { ...config, method: 'DELETE' });
}

/**
 * Namespaced entry point for the typed API client.
 *
 * const flags = await apiClient.get<FeatureFlags>('/api/admin/feature-flags');
 * await apiClient.post('/api/v1/sync/settings', { wallet, syncEnabled: true });
 */
export const apiClient = {
  get: apiGet,
  post: apiPost,
  patch: apiPatch,
  put: apiPut,
  delete: apiDelete,
};
