import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiGet, apiPost, apiPatch, apiDelete, ApiErrorClass } from '../apiClient';

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

interface TestData {
  id: number;
  name: string;
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('apiGet', () => {
    it('makes a GET request and returns typed data', async () => {
      const mockData: TestData = { id: 1, name: 'Test' };
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 }),
      );

      const result = await apiGet<TestData>('/api/test');
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('throws ApiError on non-200 status', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
      );

      await expect(apiGet<TestData>('/api/test')).rejects.toThrow(ApiErrorClass);
    });
  });

  describe('apiPost', () => {
    it('makes a POST request with body', async () => {
      const mockData: TestData = { id: 1, name: 'Created' };
      const payload = { name: 'Test' };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 }),
      );

      const result = await apiPost<TestData>('/api/test', payload);
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });

    it('handles empty response body', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));

      const result = await apiPost('/api/test');
      expect(result).toEqual({});
    });
  });

  describe('apiPatch', () => {
    it('makes a PATCH request with body', async () => {
      const mockData: TestData = { id: 1, name: 'Updated' };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 }),
      );

      const result = await apiPatch<TestData>('/api/test/1', { name: 'Updated' });
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test/1',
        expect.objectContaining({
          method: 'PATCH',
        }),
      );
    });
  });

  describe('apiDelete', () => {
    it('makes a DELETE request', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

      await apiDelete('/api/test/1');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test/1',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('handles network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiGet('/api/test')).rejects.toThrow(ApiErrorClass);
    });

    it('parses error message from response body', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Custom error message' }), { status: 400 }),
      );

      try {
        await apiGet('/api/test');
      } catch (error) {
        if (error instanceof ApiErrorClass) {
          expect(error.message).toBe('Custom error message');
          expect(error.status).toBe(400);
        }
      }
    });

    it('handles malformed JSON in response', async () => {
      fetchMock.mockResolvedValueOnce(new Response('invalid json', { status: 200 }));

      const result = await apiGet('/api/test');
      expect(result).toEqual({});
    });

    it('respects custom headers', async () => {
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await apiGet('/api/test', {
        headers: { 'X-Custom-Header': 'value' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'value',
          }),
        }),
      );
    });
  });
});
