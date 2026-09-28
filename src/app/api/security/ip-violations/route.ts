import { NextRequest, NextResponse } from 'next/server';
import { ipWhitelistService } from '@/lib/ip-whitelist';
import { logger } from '@/lib/logger';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';
import { decodeCursor, createPaginatedResponse } from '@/lib/pagination';

export async function GET(request: NextRequest) {
  try {
    const userAddress = request.headers.get('x-user-address');
    if (!userAddress) {
      return ErrorHandler.validation('User address required');
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 1000);

    const offset = decodeCursor(cursor);
    const violations = await ipWhitelistService.getViolations(userAddress, limit + 1, offset);

    const hasMore = violations.length > limit;
    const data = hasMore ? violations.slice(0, limit) : violations;

    return NextResponse.json(
      createPaginatedResponse(data, offset, limit, offset + violations.length),
    );
  } catch (error) {
    logger.error('Failed to fetch IP violations', { error });
    return ErrorHandler.handle(
      new ApiError(ErrorType.SERVER_ERROR, 'Failed to fetch IP violations'),
    );
  }
}
