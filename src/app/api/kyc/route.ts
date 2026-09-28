import { NextRequest, NextResponse } from 'next/server';
import { getKycService } from '@/lib/kyc-service';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';

const kycService = getKycService();

// GET: KYC status, AML result, reminders, or compliance report
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const action = req.nextUrl.searchParams.get('action');

    if (action === 'compliance-report') {
      const from = parseInt(req.nextUrl.searchParams.get('from') || '0');
      const to = parseInt(req.nextUrl.searchParams.get('to') || String(Date.now()));
      const report = kycService.generateComplianceReport(from, to);
      return NextResponse.json({ report });
    }

    if (!userId) {
      return ErrorHandler.validation('userId is required');
    }

    if (action === 'aml') {
      const result = kycService.getAMLResult(userId);
      return NextResponse.json({ aml: result });
    }

    if (action === 'reminders') {
      const reminders = kycService.getKYCRenewalReminders(userId);
      return NextResponse.json({ reminders });
    }

    if (action === 'limits') {
      const limits = kycService.getUserLimits(userId);
      return NextResponse.json({ limits });
    }

    const kyc = kycService.getKYC(userId);
    return NextResponse.json({ kyc });
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}

// POST: submit KYC, upload document, run AML screening, provider verification
export async function POST(req: NextRequest) {
  try {
    const {
      action,
      userId,
      documentType,
      documentId,
      fileName,
      mimeType,
      transactionAmount,
      requestedTier,
      identityData,
    } = await req.json();

    if (!userId) {
      return ErrorHandler.validation('userId is required');
    }

    if (action === 'upload-document') {
      if (!documentType || !documentId) {
        return ErrorHandler.validation('documentType and documentId are required');
      }
      const upload = kycService.uploadDocument(userId, documentType, documentId, fileName, mimeType);
      return NextResponse.json({ success: true, upload, kyc: kycService.getKYC(userId) });
    }

    if (action === 'aml-screen') {
      const result = kycService.screenAML(userId, transactionAmount);
      return NextResponse.json({ success: true, aml: result });
    }

    if (action === 'submit') {
      if (!documentType || !documentId) {
        return ErrorHandler.validation('documentType and documentId are required');
      }
      const kyc = kycService.submitKYC(userId, documentType, documentId);
      return NextResponse.json({ success: true, kyc });
    }

    if (action === 'provider-verify') {
      if (!requestedTier) return ErrorHandler.validation('requestedTier is required');
      const result = await kycService.submitProviderVerification(
        userId,
        requestedTier,
        identityData ?? {},
      );
      return NextResponse.json({ success: true, verification: result });
    }

    return ErrorHandler.validation(
      'action must be "submit", "upload-document", "aml-screen", or "provider-verify"',
    );
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}

// PATCH: verify/reject KYC, approve/reject limit increase
export async function PATCH(req: NextRequest) {
  try {
    const { action, userId, reason, requestedTier, requestId } = await req.json();

    if (!userId || !action) {
      return ErrorHandler.validation('userId and action are required');
    }

    if (action === 'verify') {
      const kyc = kycService.verifyKYC(userId);
      if (!kyc) return ErrorHandler.notFound('KYC submission');
      return NextResponse.json({ success: true, kyc });
    }

    if (action === 'reject') {
      if (!reason) return ErrorHandler.validation('reason is required to reject KYC');
      const kyc = kycService.rejectKYC(userId, reason);
      if (!kyc) return ErrorHandler.notFound('KYC submission');
      return NextResponse.json({ success: true, kyc });
    }

    if (action === 'request-limit-increase') {
      if (!requestedTier) return ErrorHandler.validation('requestedTier is required');
      const request = kycService.requestLimitIncrease(userId, requestedTier);
      return NextResponse.json({ success: true, request });
    }

    if (action === 'approve-limit-increase') {
      if (!requestId) return ErrorHandler.validation('requestId is required');
      const approved = kycService.approveLimitIncrease(userId, requestId);
      if (!approved)
        return ErrorHandler.handle(
          new ApiError(ErrorType.NOT_FOUND, 'Request not found or already processed'),
        );
      return NextResponse.json({ success: true, limits: kycService.getUserLimits(userId) });
    }

    if (action === 'request-reverification') {
      if (!reason) return ErrorHandler.validation('reason is required');
      const result = await kycService.requestReverification(userId, reason);
      return NextResponse.json({ success: true, ...result });
    }

    return ErrorHandler.validation('Unknown action');
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}
