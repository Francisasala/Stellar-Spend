import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ErrorHandler } from '@/lib/error-handler';
import { createApiKey, listApiKeys } from '@/lib/api-keys';
import { requireApiKeyAdmin } from '@/app/api/api-keys/_utils';
import { SCOPE_CATALOG, type Scope } from '@/lib/api-keys';
import { validateBody } from '@/lib/validation/validate-request';

const createApiKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).optional(),
  rateLimitMaxRequests: z.number().positive().optional(),
  rateLimitWindowMs: z.number().positive().optional(),
  expiresAt: z.number().optional(),
});

export async function GET(request: NextRequest) {
  const unauthorized = requireApiKeyAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const apiKeys = await listApiKeys();
    return NextResponse.json({ data: apiKeys }, { status: 200 });
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKeyAdmin(request);
  if (unauthorized) return unauthorized;

  const validation = await validateBody(request, createApiKeySchema);
  if (!validation.success) return validation.response;
  const body = validation.data;

  let scopes: Scope[] | undefined;
  if (body.scopes !== undefined) {
    const validScopeKeys = Object.keys(SCOPE_CATALOG) as Scope[];
    for (const s of body.scopes) {
      if (!validScopeKeys.includes(s as Scope)) {
        return ErrorHandler.validation(
          `Invalid scope: "${s}". Valid scopes: ${validScopeKeys.join(', ')}`,
        );
      }
    }
    scopes = body.scopes as Scope[];
  }

  try {
    const apiKey = await createApiKey({
      name: body.name,
      scopes,
      rateLimitMaxRequests:
        typeof body.rateLimitMaxRequests === 'number' ? body.rateLimitMaxRequests : undefined,
      rateLimitWindowMs:
        typeof body.rateLimitWindowMs === 'number' ? body.rateLimitWindowMs : undefined,
      expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : undefined,
    });

    return NextResponse.json({ data: apiKey }, { status: 201 });
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}
