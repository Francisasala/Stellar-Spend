import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TransactionStorage } from '@/lib/transaction-storage';
import { withIdempotency } from '@/lib/idempotency';
import { ErrorHandler } from '@/lib/error-handler';
import { validateBody } from '@/lib/validation/validate-request';
import {
  transitionCompensation,
  InvalidCompensationTransitionError,
  type CompensationStatus,
} from '@/lib/compensation-state-machine';

const createReversalSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.string().min(1),
  reason: z.string().min(1),
});

const reviewReversalSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
});

const reversalActionSchema = z.object({
  action: z.string().min(1),
});

const REVERSAL_FEE_RATE = 0.01;
const REVERSAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ReversalRequest {
  transactionId: string;
  requestId: string;
  amount: string;
  fee: string;
  reason: string;
  status: CompensationStatus;
  requestedAt: number;
  approvedAt?: number;
  completedAt?: number;
}

export interface ReversalAnalytics {
  totalReversals: number;
  totalReversalAmount: number;
  totalFeesCollected: number;
  approvalRate: number;
  averageProcessingTimeMs: number;
  reversalsByReason: Record<string, number>;
}

const reversalRequests = new Map<string, ReversalRequest>();

function calculateReversalFee(amount: number): number {
  return parseFloat((amount * REVERSAL_FEE_RATE).toFixed(6));
}

function isWithinReversalWindow(tx: { timestamp: number }): boolean {
  return Date.now() - tx.timestamp <= REVERSAL_WINDOW_MS;
}

export async function GET(req: NextRequest) {
  try {
    const transactionId = req.nextUrl.searchParams.get('transactionId');
    const requestId = req.nextUrl.searchParams.get('requestId');

    if (requestId) {
      const request = reversalRequests.get(requestId);
      if (!request) {
        return ErrorHandler.notFound('Reversal request');
      }
      return NextResponse.json({ request });
    }

    if (!transactionId) {
      return ErrorHandler.validation('transactionId or requestId is required');
    }

    const tx = TransactionStorage.getById(transactionId);
    if (!tx) {
      return ErrorHandler.notFound('Transaction');
    }

    const eligible = TransactionStorage.isReversalEligible(tx);
    const withinWindow = isWithinReversalWindow(tx);
    const amount = parseFloat(tx.amount);
    const fee = calculateReversalFee(amount);

    return NextResponse.json({
      transactionId,
      eligible: eligible && withinWindow,
      reason: !eligible
        ? 'Transaction already reversed or not completed'
        : !withinWindow
          ? 'Outside 24-hour reversal window'
          : null,
      reversalFee: fee,
      maxReversalAmount: amount,
      netAmount: parseFloat((amount - fee).toFixed(6)),
      currentReversal: tx.reversal || null,
    });
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}

export async function POST(req: NextRequest) {
  return withIdempotency(
    req,
    async () => {
      try {
        const validation = await validateBody(req, createReversalSchema);
        if (!validation.success) return validation.response;
        const { transactionId, amount, reason } = validation.data;

        const tx = TransactionStorage.getById(transactionId);
        if (!tx) {
          return ErrorHandler.notFound('Transaction');
        }

        if (!TransactionStorage.isReversalEligible(tx)) {
          return ErrorHandler.validation('Transaction is not eligible for reversal');
        }

        if (!isWithinReversalWindow(tx)) {
          return ErrorHandler.validation('Outside 24-hour reversal window');
        }

        const reversalAmount = parseFloat(amount);
        const txAmount = parseFloat(tx.amount);
        if (reversalAmount <= 0 || reversalAmount > txAmount) {
          return ErrorHandler.validation('Invalid reversal amount');
        }

        const fee = calculateReversalFee(reversalAmount);
        const requestId = `REV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        const request: ReversalRequest = {
          transactionId,
          requestId,
          amount,
          fee: fee.toFixed(6),
          reason,
          status: 'pending',
          requestedAt: Date.now(),
        };
        reversalRequests.set(requestId, request);

        TransactionStorage.reverse(transactionId, amount, reason);

        return NextResponse.json({
          success: true,
          message: 'Reversal request submitted',
          requestId,
          reversalFee: fee,
          netAmount: parseFloat((reversalAmount - fee).toFixed(6)),
          transaction: TransactionStorage.getById(transactionId),
        });
      } catch (error) {
        return ErrorHandler.serverError(error);
      }
    },
    { required: true },
  );
}

export async function PATCH(req: NextRequest) {
  return withIdempotency(
    req,
    async () => {
      try {
        const validation = await validateBody(req, reviewReversalSchema);
        if (!validation.success) return validation.response;
        const { requestId, action, notes } = validation.data;

        const request = reversalRequests.get(requestId);
        if (!request) {
          return ErrorHandler.notFound('Reversal request');
        }

        if (request.status !== 'pending') {
          return ErrorHandler.validation(`Reversal is already ${request.status}`);
        }

        if (action === 'approve') {
          transitionCompensation('reversal', requestId, request.status, 'approved');
          request.status = 'approved';
          request.approvedAt = Date.now();

          transitionCompensation('reversal', requestId, request.status, 'completed');
          TransactionStorage.updateReversalStatus(request.transactionId, 'completed');
          request.status = 'completed';
          request.completedAt = Date.now();
        } else {
          transitionCompensation('reversal', requestId, request.status, 'rejected');
          request.status = 'rejected';
          TransactionStorage.updateReversalStatus(request.transactionId, 'failed');
        }

        reversalRequests.set(requestId, request);

        return NextResponse.json({
          success: true,
          request,
          notes: notes || null,
        });
      } catch (error) {
        if (error instanceof InvalidCompensationTransitionError) {
          return ErrorHandler.validation(error.message);
        }
        return ErrorHandler.serverError(error);
      }
    },
    { required: true },
  );
}

export async function PUT(req: NextRequest) {
  try {
    const validation = await validateBody(req, reversalActionSchema);
    if (!validation.success) return validation.response;
    const { action } = validation.data;

    if (action === 'analytics') {
      const requests = Array.from(reversalRequests.values());
      const completed = requests.filter((r) => r.status === 'completed');
      const approved = requests.filter((r) => r.status === 'approved' || r.status === 'completed');

      const analytics: ReversalAnalytics = {
        totalReversals: requests.length,
        totalReversalAmount: completed.reduce((s, r) => s + parseFloat(r.amount), 0),
        totalFeesCollected: completed.reduce((s, r) => s + parseFloat(r.fee), 0),
        approvalRate: requests.length ? approved.length / requests.length : 0,
        averageProcessingTimeMs: completed.length
          ? completed.reduce((s, r) => s + ((r.completedAt ?? r.requestedAt) - r.requestedAt), 0) /
            completed.length
          : 0,
        reversalsByReason: requests.reduce<Record<string, number>>((acc, r) => {
          acc[r.reason] = (acc[r.reason] || 0) + 1;
          return acc;
        }, {}),
      };

      return NextResponse.json({ analytics });
    }

    return ErrorHandler.validation('Unknown action');
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}
