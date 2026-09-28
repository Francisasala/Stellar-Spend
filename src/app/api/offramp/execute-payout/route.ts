import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { dal } from '@/lib/db';
import type { Transaction } from '@/lib/transaction-storage';
import { calculateAllFees } from '@/lib/fee-calculation';
import { withIdempotency } from '@/lib/idempotency';
import { KYCLimitService } from '@/lib/kyc-limits';
import { isSupportedCurrency } from '@/lib/currencies';
import { screenAddress, isHighValue } from '@/lib/compliance-screening';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';
import { validateBody } from '@/lib/validation/validate-request';

type FeeMethodInput = 'USDC' | 'XLM' | 'stablecoin' | 'native';

function normalizeFeeMethod(feeMethod?: FeeMethodInput): Transaction['feeMethod'] | undefined {
  if (!feeMethod) return undefined;
  if (feeMethod === 'USDC' || feeMethod === 'stablecoin') return 'stablecoin';
  if (feeMethod === 'XLM' || feeMethod === 'native') return 'native';
  return undefined;
}

const executePayoutSchema = z.object({
  userAddress: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().min(1),
  beneficiary: z
    .object({
      institution: z.string().min(1),
      accountIdentifier: z.string().min(1),
      accountName: z.string().min(1),
      currency: z.string().min(1),
    })
    .passthrough(),
  receiveAmount: z.string().optional(),
  feeMethod: z.enum(['USDC', 'XLM', 'stablecoin', 'native']).optional(),
});

export async function POST(request: NextRequest) {
  return withIdempotency(
    request,
    async () => {
      const validation = await validateBody(request, executePayoutSchema);
      if (!validation.success) return validation.response;
      const body = validation.data;

      const { userAddress, amount, currency, beneficiary, receiveAmount } = body;

      if (!isSupportedCurrency(currency)) {
        return ErrorHandler.validation(`Unsupported currency: ${currency}`);
      }

      // Server-side KYC limit enforcement
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return ErrorHandler.validation('Invalid amount');
      }

      // Compliance screening on source address and beneficiary account
      const sourceScreen = await screenAddress(
        { address: userAddress, addressType: 'stellar', amount: numericAmount, currency },
        { failClosed: isHighValue(numericAmount) },
      );
      if (sourceScreen.verdict === 'deny') {
        return ErrorHandler.handle(
          new ApiError(ErrorType.FORBIDDEN, 'Source address blocked by compliance', 403, {
            screening: sourceScreen,
          }),
        );
      }

      if (beneficiary?.accountIdentifier) {
        const beneficiaryScreen = await screenAddress({
          address: beneficiary.accountIdentifier,
          addressType: 'bank',
          amount: numericAmount,
          currency,
        });
        if (beneficiaryScreen.verdict === 'deny') {
          return ErrorHandler.handle(
            new ApiError(ErrorType.FORBIDDEN, 'Beneficiary account blocked by compliance', 403, {
              screening: beneficiaryScreen,
            }),
          );
        }
      }

      const canTransact = KYCLimitService.canTransact(userAddress, numericAmount, currency);
      if (!canTransact.allowed) {
        return ErrorHandler.forbidden(`Transaction blocked: ${canTransact.reason}`);
      }

      const feeMethod = normalizeFeeMethod(body.feeMethod);
      const feeBreakdown = feeMethod
        ? await calculateAllFees({ amount, currency, feeMethod, receiveAmount })
        : null;

      const id = uuidv4();
      const transaction: Transaction = {
        id,
        timestamp: Date.now(),
        userAddress,
        amount,
        currency,
        feeMethod,
        bridgeFee: feeBreakdown?.bridgeFee,
        networkFee: feeBreakdown?.networkFee,
        paycrestFee: feeBreakdown?.paycrestFee,
        totalFee: feeBreakdown?.totalFee,
        beneficiary,
        status: 'pending',
      };

      try {
        await dal.save(transaction);
      } catch {
        return ErrorHandler.handle(new ApiError(ErrorType.SERVER_ERROR, 'internal server error'));
      }

      // Record the transaction for KYC limit tracking
      KYCLimitService.recordTransaction(userAddress, numericAmount);

      return NextResponse.json({ id, status: 'pending' }, { status: 200 });
    },
    { required: true },
  );
}
