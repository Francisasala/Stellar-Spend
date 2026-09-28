import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TwoFAService } from '@/lib/two-fa';
import { ErrorHandler } from '@/lib/error-handler';
import { validateBody } from '@/lib/validation/validate-request';

const verifySchema = z.object({
  userId: z.string().min(1),
  code: z.string().min(1),
  method: z.string().min(1),
  secret: z.string().optional(),
  backupCodes: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const validation = await validateBody(req, verifySchema);
    if (!validation.success) return validation.response;
    const { userId, code, method, secret, backupCodes } = validation.data;
    void userId;

    if (method === 'totp') {
      if (!secret) {
        return ErrorHandler.validation('Missing TOTP secret');
      }

      const isValid = TwoFAService.verifyTOTP(secret, code);
      if (!isValid) {
        return ErrorHandler.unauthorized('Invalid TOTP code');
      }

      return NextResponse.json({
        success: true,
        message: '2FA verified successfully',
        verified: true,
      });
    }

    if (method === 'backup') {
      if (!backupCodes) {
        return ErrorHandler.validation('Missing backup codes');
      }

      const { isValid, remainingCodes } = TwoFAService.verifyBackupCode(backupCodes, [], code);

      if (!isValid) {
        return ErrorHandler.unauthorized('Invalid backup code');
      }

      return NextResponse.json({
        success: true,
        message: 'Backup code verified',
        verified: true,
        remainingCodes,
      });
    }

    return ErrorHandler.validation('Unsupported verification method');
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}
