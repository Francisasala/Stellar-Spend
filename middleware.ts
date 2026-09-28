import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from './src/lib/security/headers';
import { authMiddleware } from './src/lib/middleware/auth';
import { geoMiddleware, attachGeoHeaders } from './src/lib/middleware/geo';
import { createLoggingMiddleware } from './src/lib/middleware/logging';
import {
  compressionMiddleware,
  addCompressionHeaders,
} from './src/lib/middleware/compression.middleware';
import {
  publicApiRateLimitMiddleware,
  addRateLimitHeaders,
} from './src/lib/middleware/public-api-rate-limit.middleware';
import { composeGuards, composeTransforms } from './src/lib/middleware/pipeline';

// Guards run in order; the first one to return a response short-circuits
// the chain (e.g. a geo block or an auth/versioning rejection).
const runGuards = composeGuards(geoMiddleware, authMiddleware);

// Transforms always run, regardless of which guard (if any) produced the
// response, decorating it with the headers every response needs.
const runTransforms = composeTransforms(
  (response, request) => attachGeoHeaders(response, request),
  (response, request) => addCompressionHeaders(response, new URL(request.url).pathname),
  (response, request) => addRateLimitHeaders(response, request),
  (response) => addSecurityHeaders(response),
);

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  // Resolve the correlation ID once, up front, so the value logged here is
  // the exact same value route handlers see via request.headers.get('x-request-id').
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  // Apply compression middleware to the request before running guards, so
  // guards see the (possibly rewritten) request.
  let modifiedRequest = request;
  const compressionReq = compressionMiddleware(request);
  if (compressionReq) {
    modifiedRequest = compressionReq;
    modifiedRequest.headers.set('x-request-id', requestId);
  }

  // Check rate limiting first (issue #967), ahead of the geo/auth guard chain.
  const isAuthenticated = !!request.headers.get('x-account-id');
  const rateLimitResponse = await publicApiRateLimitMiddleware(modifiedRequest, isAuthenticated);

  const guardResponse = rateLimitResponse ?? runGuards(modifiedRequest);
  let response =
    guardResponse ?? NextResponse.next({ request: { headers: modifiedRequest.headers } });

  response = runTransforms(response, request);

  const durationMs = Date.now() - start;
  const loggingMiddleware = createLoggingMiddleware();
  response = loggingMiddleware(request, response, durationMs, requestId);

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
