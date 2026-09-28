import { NextRequest, NextResponse } from 'next/server';

const LARGE_PAYLOAD_THRESHOLD = 1024; // 1KB

const COMPRESSIBLE_ROUTES = [
  /^\/api\/security\/audit-logs/,
  /^\/api\/admin\/disputes/,
  /^\/api\/webhooks\/delivery-log/,
  /^\/api\/monitoring\/metrics/,
  /^\/api\/transactions/,
  /^\/api\/history/,
];

/**
 * Check if the route should have compression applied.
 */
function shouldCompress(pathname: string): boolean {
  return COMPRESSIBLE_ROUTES.some(pattern => pattern.test(pathname));
}

/**
 * Compression middleware that sets appropriate headers for large payloads.
 * Actual compression is handled by edge runtime / deployment platform.
 */
export function compressionMiddleware(request: NextRequest): NextRequest | null {
  const pathname = new URL(request.url).pathname;

  if (!shouldCompress(pathname)) {
    return null;
  }

  const headers = new Headers(request.headers);

  // Request compression (for POST/PUT with large bodies)
  headers.set('Accept-Encoding', 'gzip, deflate, br');

  return new NextRequest(request, { headers });
}

/**
 * Add compression headers to response.
 * Signals to edge runtime that compression should be applied for large responses.
 */
export function addCompressionHeaders(response: NextResponse, pathname: string): NextResponse {
  if (!shouldCompress(pathname)) {
    return response;
  }

  const headers = new Headers(response.headers);

  // Ensure content encoding is not duplicated
  if (!headers.has('Content-Encoding')) {
    // Let the edge runtime handle actual compression based on Accept-Encoding
    headers.set('Vary', 'Accept-Encoding');

    // Enable compression for large responses
    const contentLength = headers.get('Content-Length');
    if (contentLength && parseInt(contentLength, 10) > LARGE_PAYLOAD_THRESHOLD) {
      headers.append('Cache-Control', 'public');
    }
  }

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
