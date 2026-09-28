import { NextRequest, NextResponse } from 'next/server';

/**
 * A guard inspects the request and may short-circuit the chain by
 * returning a response (e.g. a redirect or a 403). Returning `null` means
 * "allow the request to continue to the next guard".
 */
export type Guard = (request: NextRequest) => NextResponse | null;

/**
 * A transform decorates a response that has already been produced (by a
 * guard short-circuit or by the default pass-through response). Transforms
 * always run, regardless of which guard — if any — produced the response.
 */
export type Transform = (response: NextResponse, request: NextRequest) => NextResponse;

/**
 * Runs guards in order, returning the first non-null response. Returns
 * `null` if every guard allows the request through.
 */
export function composeGuards(...guards: Guard[]): Guard {
  return (request) => {
    for (const guard of guards) {
      const result = guard(request);
      if (result) return result;
    }
    return null;
  };
}

/**
 * Folds transforms over a response in order, so each transform sees the
 * output of the previous one.
 */
export function composeTransforms(...transforms: Transform[]): Transform {
  return (response, request) =>
    transforms.reduce((res, transform) => transform(res, request), response);
}
