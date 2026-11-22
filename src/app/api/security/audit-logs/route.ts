import { NextRequest, NextResponse } from 'next/server';
import { auditLoggingService } from '@/lib/audit-logging';
import { logger } from '@/lib/logger';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';
import { createPaginatedResponse, parsePaginationQuery, trimLookahead } from '@/lib/pagination';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const { offset, limit } = parsePaginationQuery(searchParams, {
      defaultLimit: 100,
      maxLimit: 1000,
    });

    if (!userAddress) {
      return ErrorHandler.validation('userAddress query parameter required');
    }

    const logs = await auditLoggingService.getUserAuditLogs(userAddress, limit + 1, offset);
    const { data } = trimLookahead(logs, limit);

    return NextResponse.json(createPaginatedResponse(data, offset, limit, offset + logs.length));
  } catch (error) {
    logger.error('Failed to fetch audit logs', { error });
    return ErrorHandler.handle(new ApiError(ErrorType.SERVER_ERROR, 'Failed to fetch audit logs'));
  }
}
