import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';
import { ErrorHandler } from '@/lib/errors/error-handler';

/**
 * Shape of a single formatted validation issue.
 */
export interface ValidationFieldError {
  path: string;
  message: string;
  code: string;
}

/**
 * Result of a validation attempt.
 *
 * On success, `data` holds the parsed (and possibly transformed) value and
 * `response` is `undefined`. On failure, `data` is `undefined` and `response`
 * holds a ready-to-return 400 `NextResponse` built with the standardized error
 * envelope via `ErrorHandler.validation`.
 */
export type ValidationResult<T> =
  | { success: true; data: T; response?: undefined }
  | { success: false; data?: undefined; response: NextResponse };

/**
 * Convert a `ZodError` into a flat list of field errors.
 */
export function formatZodIssues(error: ZodError): ValidationFieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Build a standardized 400 response for a validation failure.
 */
export function buildValidationErrorResponse(
  error: ZodError,
  message = 'Request validation failed',
): NextResponse {
  const fieldErrors = formatZodIssues(error);
  return ErrorHandler.validation(message, fieldErrors);
}

/**
 * Internal helper that parses `input` with `schema` and returns either the
 * parsed data or a standardized 400 response.
 */
function parseWithSchema<T>(
  schema: ZodSchema<T>,
  input: unknown,
  message?: string,
): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    response: buildValidationErrorResponse(result.error, message),
  };
}

/**
 * Safely read and parse a JSON request body.
 *
 * Returns `undefined` when the body is empty or not valid JSON so that the
 * schema can decide whether that is acceptable (e.g. optional body). This keeps
 * previously accepted inputs (empty bodies) backwards compatible.
 */
async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    const text = await request.text();
    if (text.trim() === '') {
      return undefined;
    }
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Validate a JSON request body against a zod schema.
 *
 * On success returns `{ success: true, data }`. On failure returns
 * `{ success: false, response }` where `response` is a standardized 400.
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  message = 'Invalid request body',
): Promise<ValidationResult<T>> {
  const body = await readJsonBody(request);
  return parseWithSchema(schema, body, message);
}

/**
 * Validate query string parameters against a zod schema.
 *
 * The raw query object is provided as a plain record of string values (with
 * repeated keys collapsed to arrays) so existing query handling remains
 * backwards compatible.
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  message = 'Invalid query parameters',
): ValidationResult<T> {
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(request.nextUrl.searchParams.keys())) {
    const values = request.nextUrl.searchParams.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }
  return parseWithSchema(schema, query, message);
}

/**
 * Validate dynamic route parameters against a zod schema.
 */
export function validateParams<T>(
  params: unknown,
  schema: ZodSchema<T>,
  message = 'Invalid route parameters',
): ValidationResult<T> {
  return parseWithSchema(schema, params, message);
}

/**
 * Convenience re-export so callers can build schemas from the same zod
 * instance used for validation.
 */
export { z };
