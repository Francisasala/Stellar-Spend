import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { dal, DatabaseError } from '@/lib/db';
import { ErrorHandler } from '@/lib/error-handler';
import type { Transaction } from '@/lib/transaction-storage';
import { withIdempotency } from '@/lib/idempotency';
import { validateBody } from '@/lib/validation/validate-request';

const createTransactionSchema = z
  .object({
    id: z.string().min(1),
    timestamp: z.number(),
    userAddress: z.string().min(1),
    amount: z.string().min(1),
    currency: z.string().min(1),
    beneficiary: z.object({
      institution: z.string().min(1),
      accountIdentifier: z.string().min(1),
      accountName: z.string().min(1),
      currency: z.string().min(1),
    }),
    status: z.string().min(1),
  })
  .passthrough();

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');

  if (!wallet) {
    return ErrorHandler.validation('wallet address is required');
  }

  try {
    const transactions = await dal.getByUser(wallet);
    return NextResponse.json(transactions, { status: 200 });
  } catch (err) {
    if (err instanceof DatabaseError) {
      return ErrorHandler.serverError(err);
    }
    return ErrorHandler.serverError(err);
  }
}

export async function POST(request: NextRequest) {
  return withIdempotency(
    request,
    async () => {
      const validation = await validateBody(request, createTransactionSchema);
      if (!validation.success) return validation.response;

      const transaction = validation.data as unknown as Transaction;

      try {
        await dal.save(transaction);
        return NextResponse.json(transaction, { status: 201 });
      } catch (err) {
        if (err instanceof DatabaseError) {
          return ErrorHandler.serverError(err);
        }
        return ErrorHandler.serverError(err);
      }
    },
    { required: true },
  );
}
