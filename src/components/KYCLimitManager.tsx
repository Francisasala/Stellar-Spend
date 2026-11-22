'use client';

import { useState } from 'react';
import { Button } from '@/components/design-system';
import { useKYCLimits } from '@/hooks/useKYCLimits';
import { KYCStatusCard } from '@/components/kyc/KYCStatusCard';
import { KYCForm } from '@/components/kyc/KYCForm';
import { LimitsCard } from '@/components/kyc/LimitsCard';
import { LimitIncreaseRequestForm } from '@/components/kyc/LimitIncreaseRequestForm';

interface KYCLimitManagerProps {
  userId: string;
}

export function KYCLimitManager({ userId }: KYCLimitManagerProps) {
  const { kycStatus, limits, isLoading, error, refetch, submitKYC, requestLimitIncrease } =
    useKYCLimits(userId);

  const [showKYCForm, setShowKYCForm] = useState(false);
  const [showLimitRequest, setShowLimitRequest] = useState(false);

  const handleSubmitKYC = (data: { documentType: string; documentId: string }) => {
    submitKYC(data.documentType, data.documentId);
    setShowKYCForm(false);
  };

  const handleRequestLimitIncrease = (tier: Parameters<typeof requestLimitIncrease>[0]) => {
    requestLimitIncrease(tier);
    setShowLimitRequest(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <div className="p-4 text-sm text-gray-600">Loading KYC and limits…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4" role="alert">
        <div className="p-4 text-sm text-red-600">
          Failed to load KYC and limits: {error.message}
        </div>
        <Button onClick={refetch} variant="secondary">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <KYCStatusCard
        kycStatus={kycStatus}
        showForm={showKYCForm}
        onStartKYC={() => setShowKYCForm(true)}
      >
        {showKYCForm && (
          <KYCForm onSubmit={handleSubmitKYC} onCancel={() => setShowKYCForm(false)} />
        )}
      </KYCStatusCard>

      {limits && (
        <LimitsCard
          limits={limits}
          showRequestForm={showLimitRequest}
          onShowRequestForm={() => setShowLimitRequest(true)}
        >
          {showLimitRequest && (
            <LimitIncreaseRequestForm
              currentTier={limits.tier}
              onSubmit={handleRequestLimitIncrease}
              onCancel={() => setShowLimitRequest(false)}
            />
          )}
        </LimitsCard>
      )}
    </div>
  );
}
