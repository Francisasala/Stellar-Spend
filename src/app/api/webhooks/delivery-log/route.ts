import { NextRequest, NextResponse } from 'next/server';
import { ErrorHandler } from '@/lib/error-handler';
import { getDeliveryLogs } from '@/lib/webhook';
import { requireApiKeyAdmin } from '@/app/api/api-keys/_utils';
import { decodeCursor, createPaginatedResponse } from '@/lib/pagination';

export async function GET(request: NextRequest) {
  const unauthorized = requireApiKeyAdmin(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = request.nextUrl;
  const subscriptionId = searchParams.get('subscriptionId');
  const cursor = searchParams.get('cursor');
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

  try {
    const offset = decodeCursor(cursor);
    const logs = await getDeliveryLogs(subscriptionId ?? undefined, limit + 1, offset);
    const hasMore = logs.length > limit;
    const data = hasMore ? logs.slice(0, limit) : logs;

    return NextResponse.json(
      createPaginatedResponse(data, offset, limit, offset + logs.length),
    );
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}
