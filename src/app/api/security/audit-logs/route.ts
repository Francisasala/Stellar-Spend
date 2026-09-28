import { NextRequest, NextResponse } from 'next/server';
import { auditLoggingService } from '@/lib/audit-logging';
import { logger } from '@/lib/logger';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';
import { decodeCursor, createPaginatedResponse } from '@/lib/pagination';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);

    if (!userAddress) {
      return ErrorHandler.validation('userAddress query parameter required');
    }

    const offset = decodeCursor(cursor);
    const logs = await auditLoggingService.getUserAuditLogs(userAddress, limit + 1, offset);
    const hasMore = logs.length > limit;
    const data = hasMore ? logs.slice(0, limit) : logs;

    return NextResponse.json(
      createPaginatedResponse(data, offset, limit, offset + logs.length),
    );
  } catch (error) {
    logger.error('Failed to fetch audit logs', { error });
    return ErrorHandler.handle(new ApiError(ErrorType.SERVER_ERROR, 'Failed to fetch audit logs'));
  }
}
