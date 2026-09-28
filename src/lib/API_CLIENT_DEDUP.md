# HTTP client dedup: `api-utils.ts` vs `apiClient.ts`

## What was found

- `src/lib/apiClient.ts` was already a deprecated re-export pointing at
  `src/lib/api/client.ts`, which owns the canonical `apiRequest` implementation
  (timeout/abort handling, JSON parsing via `parseJsonResponse`-equivalent
  logic, and `ApiErrorClass` error normalization).
- `src/lib/api-utils.ts` had its own **separate** `apiRequest`/`apiGet`/`apiPost`/
  `apiPut`/`apiDelete` implementation: a second `AbortController` + `setTimeout`
  pair, its own `response.json()` parsing, and its own ad-hoc error message
  extraction (`data['error']`). This was the actual duplicated HTTP wrapper
  logic the issue described — two independent retry/timeout/error-mapping
  code paths for client-side requests.

## What changed

- `src/lib/api-utils.ts` no longer implements its own fetch/timeout/parsing
  logic. Its `apiRequest`/`apiGet`/`apiPost`/`apiPut`/`apiDelete` functions now
  translate the legacy `ApiRequestOptions` (a `RequestInit` extension) into
  `ApiRequestConfig` and delegate directly to `apiGet`/`apiPost`/`apiPut`/
  `apiDelete` exported from `src/lib/api/client.ts`.
- `successResponse` and `getErrorMessage` (server-side envelope helpers, not
  HTTP client logic) are unchanged and remain in `api-utils.ts`.
- `apiClient.ts` is untouched — it already pointed at the single source of
  truth.

## Consumers

Existing imports of `apiGet`/`apiPost`/`apiPut`/`apiDelete`/`apiRequest` from
`@/lib/api-utils` keep working with the same call signature; behavior
(headers, JSON body, timeout, thrown-error shape) now comes from a single
implementation instead of two. New code should prefer importing from
`@/lib/api/client` (or the `apiClient` namespace export) directly.

## Tests

Added `src/lib/api-utils.test.ts`, covering GET/POST/PUT/DELETE delegation
and error normalization through the shared implementation.
