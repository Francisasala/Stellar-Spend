import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ErrorHandler } from '@/lib/error-handler';
import { withIdempotency } from '@/lib/idempotency';
import { validateBody } from '@/lib/validation/validate-request';
import { listTransactionsByWallet, createTransaction } from '@/lib/services/transactions';

const walletQuerySchema = z.object({
  wallet: z.string().min(1),
});

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
  const parsed = walletQuerySchema.safeParse({
    wallet: request.nextUrl.searchParams.get('wallet') ?? undefined,
  });

  if (!parsed.success) {
    return ErrorHandler.validation('wallet address is required');
  }

  try {
    const transactions = await listTransactionsByWallet(parsed.data.wallet);
    return NextResponse.json(transactions, { status: 200 });
  } catch (err) {
    return ErrorHandler.serverError(err);
  }
}

export async function POST(request: NextRequest) {
  return withIdempotency(
    request,
    async () => {
      const validation = await validateBody(request, createTransactionSchema);
      if (!validation.success) return validation.response;

      try {
        const transaction = await createTransaction(validation.data);
        return NextResponse.json(transaction, { status: 201 });
      } catch (err) {
        return ErrorHandler.serverError(err);
      }
    },
    { required: true },
  );
}
