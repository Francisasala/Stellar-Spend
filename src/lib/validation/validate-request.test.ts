import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { validateBody, validateQuery } from './validate-request';

function makeJsonRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(path: string, rawBody: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: rawBody,
  });
}

const quoteSchema = z.object({
  amount: z.string().min(1),
  currency: z.string().length(3),
});

describe('validateBody', () => {
  it('returns success with typed, parsed data for a valid payload', async () => {
    const req = makeJsonRequest('/api/quote', { amount: '100', currency: 'NGN' });
    const result = await validateBody(req, quoteSchema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ amount: '100', currency: 'NGN' });
    }
  });

  it('returns a 400 typed error response for a schema violation', async () => {
    const req = makeJsonRequest('/api/quote', { amount: '100', currency: 'NGNX' });
    const result = await validateBody(req, quoteSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error).toBe('validation_error');
      expect(body.message).toContain('currency');
    }
  });

  it('reports every failing field, not just the first', async () => {
    const req = makeJsonRequest('/api/quote', { amount: '', currency: 'X' });
    const result = await validateBody(req, quoteSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      const body = await result.response.json();
      expect(body.message).toContain('amount');
      expect(body.message).toContain('currency');
    }
  });

  it('returns a 400 typed error response for malformed JSON', async () => {
    const req = makeRawRequest('/api/quote', '{not valid json');
    const result = await validateBody(req, quoteSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.message).toMatch(/invalid json/i);
    }
  });

  it('rejects missing required fields', async () => {
    const req = makeJsonRequest('/api/quote', { amount: '100' });
    const result = await validateBody(req, quoteSchema);

    expect(result.success).toBe(false);
  });

  it('rejects unexpected extra top-level types (e.g. an array instead of an object)', async () => {
    const req = makeJsonRequest('/api/quote', ['not', 'an', 'object']);
    const result = await validateBody(req, quoteSchema);

    expect(result.success).toBe(false);
  });
});

describe('validateQuery', () => {
  const listSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100),
    status: z.enum(['active', 'inactive']).optional(),
  });

  it('parses and coerces valid query parameters', () => {
    const req = new NextRequest('http://localhost/api/list?limit=25&status=active');
    const result = validateQuery(req, listSchema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ limit: 25, status: 'active' });
    }
  });

  it('rejects an out-of-range value', () => {
    const req = new NextRequest('http://localhost/api/list?limit=1000');
    const result = validateQuery(req, listSchema);

    expect(result.success).toBe(false);
  });

  it('rejects an invalid enum value', () => {
    const req = new NextRequest('http://localhost/api/list?limit=10&status=deleted');
    const result = validateQuery(req, listSchema);

    expect(result.success).toBe(false);
  });
});
