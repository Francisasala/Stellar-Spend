import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TwoFAService } from '@/lib/two-fa';
import { ErrorHandler } from '@/lib/error-handler';
import { validateBody } from '@/lib/validation/validate-request';

// STORAGE_KEY was used in an earlier in-memory implementation; the record
// now lives in the session store. Preserved here for reference.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const STORAGE_KEY = 'stellar_spend_2fa_config';

const setupSchema = z.object({
  userId: z.string().min(1),
  method: z.enum(['totp', 'sms']),
});

export async function POST(req: NextRequest) {
  try {
    const validation = await validateBody(req, setupSchema);
    if (!validation.success) return validation.response;
    const { userId, method } = validation.data;

    if (method === 'totp') {
      const secret = TwoFAService.generateTOTPSecret();
      const backupCodes = TwoFAService.generateBackupCodes();
      const uri = TwoFAService.generateTOTPURI(secret, userId);

      return NextResponse.json({
        secret,
        uri,
        backupCodes,
        method: 'totp',
      });
    }

    if (method === 'sms') {
      return NextResponse.json({
        method: 'sms',
        message: 'SMS 2FA setup initiated. Provide phone number in verification step.',
      });
    }
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}
