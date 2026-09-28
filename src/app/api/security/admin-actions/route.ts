import { NextRequest, NextResponse } from 'next/server';
import { auditLoggingService } from '@/lib/audit-logging';
import { logger } from '@/lib/logger';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';
import { decodeCursor, createPaginatedResponse } from '@/lib/pagination';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminAddress = searchParams.get('adminAddress') || undefined;
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);

    const offset = decodeCursor(cursor);
    const actions = await auditLoggingService.getAdminActions(adminAddress, limit + 1, offset);
    const hasMore = actions.length > limit;
    const data = hasMore ? actions.slice(0, limit) : actions;

    return NextResponse.json(
      createPaginatedResponse(data, offset, limit, offset + actions.length),
    );
  } catch (error) {
    logger.error('Failed to fetch admin actions', { error });
    return ErrorHandler.handle(
      new ApiError(ErrorType.SERVER_ERROR, 'Failed to fetch admin actions'),
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminAddress = request.headers.get('x-admin-address');
    if (!adminAddress) {
      return ErrorHandler.validation('Admin address required');
    }

    const body = await request.json();
    const { actionType, targetUser, actionDetails, reason } = body;

    if (!actionType) {
      return ErrorHandler.validation('actionType is required');
    }

    const action = await auditLoggingService.logAdminAction(adminAddress, actionType, {
      targetUser,
      actionDetails,
      reason,
    });

    return NextResponse.json(action, { status: 201 });
  } catch (error) {
    logger.error('Failed to log admin action', { error });
    return ErrorHandler.handle(new ApiError(ErrorType.SERVER_ERROR, 'Failed to log admin action'));
  }
}
