import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { disputeRepository } from '@/lib/repositories';
import { DisputeStatus, DisputeUpdate } from '@stellar-spend/shared';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';
import { decodeCursor, createPaginatedResponse } from '@/lib/pagination';
import { validateBody } from '@/lib/validation/validate-request';

const disputeUpdateSchema = z.object({
  disputeId: z.string().min(1),
  update: z.object({
    status: z.enum(['open', 'in_review', 'resolved', 'rejected', 'escalated']).optional(),
    resolutionNotes: z.string().optional(),
    assignedTo: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }),
});

export async function GET(req: NextRequest) {
  try {
    // TODO: Add admin authentication check
    const status = req.nextUrl.searchParams.get('status');
    const cursor = req.nextUrl.searchParams.get('cursor');
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 1000);

    const offset = decodeCursor(cursor);
    const disputes = await disputeRepository.listDisputes(
      (status || undefined) as DisputeStatus | undefined,
      limit + 1,
      offset,
    );

    const hasMore = disputes.length > limit;
    const data = hasMore ? disputes.slice(0, limit) : disputes;

    return NextResponse.json(
      createPaginatedResponse(data, offset, limit, offset + disputes.length),
    );
  } catch (error) {
    logger.error('Error fetching disputes', {}, error);
    return ErrorHandler.handle(new ApiError(ErrorType.SERVER_ERROR, 'Failed to fetch disputes'));
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // TODO: Add admin authentication check
    const validation = await validateBody(req, disputeUpdateSchema);
    if (!validation.success) return validation.response;
    const { disputeId, update } = validation.data;

    const dispute = await disputeRepository.updateDispute(disputeId, update as DisputeUpdate);

    if (!dispute) {
      return ErrorHandler.notFound('Dispute');
    }

    return NextResponse.json(dispute);
  } catch (error) {
    logger.error('Error updating dispute', {}, error);
    return ErrorHandler.handle(new ApiError(ErrorType.SERVER_ERROR, 'Failed to update dispute'));
  }
}
