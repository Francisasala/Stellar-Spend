import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { ApiError } from '../error-types';
import { ErrorHandler } from '../error-handler';
import { formatZodErrors, type FormattedValidationError } from '../validators/schemas';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

function buildValidationError(error: z.ZodError): ApiError {
  const fieldErrors: FormattedValidationError[] = formatZodErrors(error);
  const message = `Validation failed: ${fieldErrors
    .map((f) => `${f.field} (${f.message})`)
    .join(', ')}`;

  return ApiError.validation(message, { fieldErrors });
}

/**
 * Parses a request's JSON body and validates it against a Zod schema.
 *
 * Returns `{ success: true, data }` with the parsed, typed body on success.
 * On failure (malformed JSON or a schema violation) returns
 * `{ success: false, response }` where `response` is a ready-to-return
 * typed 400 error response — callers just do:
 *
 *   const validation = await validateBody(request, mySchema);
 *   if (!validation.success) return validation.response;
 *   const body = validation.data;
 */
export async function validateBody<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S,
): Promise<ValidationResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      success: false,
      response: ErrorHandler.handle(ApiError.validation('Invalid JSON in request body')),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      response: ErrorHandler.handle(buildValidationError(result.error)),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validates a request's URL query parameters against a Zod schema.
 * Every query param arrives as a string, so schemas should expect strings
 * (use `z.coerce.number()` etc. for typed fields).
 */
export function validateQuery<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S,
): ValidationResult<z.infer<S>> {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    return {
      success: false,
      response: ErrorHandler.handle(buildValidationError(result.error)),
    };
  }
  return { success: true, data: result.data };
}
