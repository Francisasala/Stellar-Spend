import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';
import { ErrorHandler, withApiErrorHandling } from './error-handler';
import { ApiError } from './error-types';

describe('withApiErrorHandling', () => {
  it('passes through a successful response untouched', async () => {
    const handler = withApiErrorHandling(async () => NextResponse.json({ ok: true }));
    const response = await handler();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('converts a thrown ApiError into the standard error shape', async () => {
    const handler = withApiErrorHandling(async () => {
      throw ApiError.notFound('Widget');
    });
    const response = await handler();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('not_found');
    expect(body.message).toBe('Widget not found');
  });

  it('converts an unexpected thrown error into a 500 with the standard shape', async () => {
    const handler = withApiErrorHandling(async () => {
      throw new Error('boom');
    });
    const response = await handler();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('server_error');
  });
});

describe('ErrorHandler.handle', () => {
  it('preserves the status code and error type from an ApiError', async () => {
    const response = ErrorHandler.handle(ApiError.validation('bad input'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'validation_error', message: 'bad input' });
  });
});
