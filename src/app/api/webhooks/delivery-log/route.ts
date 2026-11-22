import { NextRequest, NextResponse } from 'next/server';
import { ErrorHandler } from '@/lib/error-handler';
import { getDeliveryLogs } from '@/lib/webhook';
import { requireApiKeyAdmin } from '@/app/api/api-keys/_utils';
import { createPaginatedResponse, parsePaginationQuery, trimLookahead } from '@/lib/pagination';

export async function GET(request: NextRequest) {
  const unauthorized = requireApiKeyAdmin(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = request.nextUrl;
  const subscriptionId = searchParams.get('subscriptionId');
  const { offset, limit } = parsePaginationQuery(searchParams, { defaultLimit: 50, maxLimit: 200 });

  try {
    const logs = await getDeliveryLogs(subscriptionId ?? undefined, limit + 1, offset);
    const { data } = trimLookahead(logs, limit);

    return NextResponse.json(createPaginatedResponse(data, offset, limit, offset + logs.length));
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}
