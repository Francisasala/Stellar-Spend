import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { disputeRepository } from '@/lib/repositories';
import { withIdempotency } from '@/lib/idempotency';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';
import { validateBody } from '@/lib/validation/validate-request';

const createDisputeSchema = z.object({
  transactionId: z.string().min(1),
  reason: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

export async function POST(req: NextRequest) {
  return withIdempotency(
    req,
    async () => {
      try {
        const userAddress = req.headers.get('x-user-address');
        if (!userAddress) {
          return ErrorHandler.unauthorized('User address required');
        }

        const validation = await validateBody(req, createDisputeSchema);
        if (!validation.success) return validation.response;
        const body = validation.data;

        const dispute = await disputeRepository.createDispute(userAddress, body);

        return NextResponse.json(dispute, { status: 201 });
      } catch (error) {
        logger.error('Error creating dispute:', {}, error);
        return ErrorHandler.handle(
          new ApiError(ErrorType.SERVER_ERROR, 'Failed to create dispute'),
        );
      }
    },
    { required: true },
  );
}

export async function GET(req: NextRequest) {
  try {
    const userAddress = req.headers.get('x-user-address');
    if (!userAddress) {
      return ErrorHandler.unauthorized('User address required');
    }

    const disputes = await disputeRepository.getDisputesByUser(userAddress);

    return NextResponse.json(disputes);
  } catch (error) {
    logger.error('Error fetching disputes:', {}, error);
    return ErrorHandler.handle(new ApiError(ErrorType.SERVER_ERROR, 'Failed to fetch disputes'));
  }
}
