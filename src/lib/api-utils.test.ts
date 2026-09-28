import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet, apiPost, apiPut, apiDelete, getErrorMessage } from './api-utils';

describe('api-utils client wrappers (delegate to @/lib/api/client)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      text: async () => JSON.stringify(body),
    } as Response;
  }

  it('apiGet issues a GET request and returns parsed JSON', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse({ hello: 'world' }));

    const result = await apiGet<{ hello: string }>('/api/test');

    expect(result).toEqual({ hello: 'world' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('GET');
  });

  it('apiPost sends a JSON body via a single shared implementation', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse({ id: 1 }));

    const result = await apiPost<{ id: number }>('/api/test', { name: 'x' });

    expect(result).toEqual({ id: 1 });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
  });

  it('apiPut and apiDelete use the correct HTTP methods', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse({}));

    await apiPut('/api/test', { a: 1 });
    await apiDelete('/api/test');

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1].method).toBe('PUT');
    expect(calls[1][1].method).toBe('DELETE');
  });

  it('rejects with a normalized error on non-ok responses', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse({ error: 'not found' }, false, 404),
    );

    await expect(apiGet('/api/missing')).rejects.toThrow('not found');
  });

  it('getErrorMessage normalizes Error, string, and unknown inputs', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('plain string')).toBe('plain string');
    expect(getErrorMessage({ weird: true })).toBe('An unknown error occurred');
  });
});
