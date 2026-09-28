import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionManagementService } from '@/lib/session-management';
import { logger } from '@/lib/logger';
import { ErrorHandler } from '@/lib/error-handler';
import { validateBody } from '@/lib/validation/validate-request';

const revokeSessionSchema = z.object({
  sessionId: z.string().min(1).optional(),
  revokeAll: z.boolean().optional(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userAddress = request.headers.get('x-user-address');
    if (!userAddress) {
      return ErrorHandler.validation('User address required');
    }

    const validation = await validateBody(request, revokeSessionSchema);
    if (!validation.success) return validation.response;
    const { sessionId, revokeAll, reason } = validation.data;

    if (revokeAll) {
      await sessionManagementService.revokeAllUserSessions(userAddress, reason);
      return NextResponse.json({ success: true, message: 'All sessions revoked' });
    }

    if (!sessionId) {
      return ErrorHandler.validation('Session ID or revokeAll flag required');
    }

    await sessionManagementService.revokeSession(sessionId, reason);
    return NextResponse.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    logger.error('Failed to revoke session', { error });
    return ErrorHandler.serverError(error);
  }
}
