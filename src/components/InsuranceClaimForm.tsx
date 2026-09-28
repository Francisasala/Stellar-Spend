'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useForm } from '@/hooks/useForm';
import { apiPatch } from '@/lib/api/client';
import {
  type InsuranceClaimFormProps,
  insuranceClaimSchema,
} from './insurance-claim/types';
import { ClaimFormHeader } from './insurance-claim/ClaimFormHeader';
import { EligibilityState } from './insurance-claim/EligibilityState';
import { ClaimFormFields } from './insurance-claim/ClaimFormFields';

export * from './insurance-claim/types';

export function InsuranceClaimForm({
  transactionId,
  insuranceId,
  coverage,
  onSuccess,
  onCancel,
}: InsuranceClaimFormProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const {
    values,
    isSubmitting: loading,
    submitError,
    errors,
    setFieldValue,
    setSubmitError,
    handleSubmit: submitForm,
  } = useForm({
    initialValues: {
      reason: '',
      evidence: '',
    },
    schema: insuranceClaimSchema,
    onSubmit: async (formValues) => {
      if (!isEligible) return;

      if (insuranceId.startsWith('ins_')) {
        await new Promise((r) => setTimeout(r, 1000));
        onSuccess(`CLAIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
        return;
      }

      const data = await apiPatch<{ claim?: { claim_id?: string; id?: string } }>(
        `/api/transactions/${encodeURIComponent(transactionId)}/insurance`,
        {
          insuranceId,
          reason: formValues.reason,
          evidence: formValues.evidence || undefined,
        },
      );

      const claimId = data?.claim?.claim_id ?? data?.claim?.id ?? 'CLAIM-FILED';
      onSuccess(claimId);
    },
  });

  const error = fileError || submitError || errors.reason;

  useEffect(() => {
    const check = async () => {
      setIsCheckingEligibility(true);
      await new Promise((r) => setTimeout(r, 1500));
      setIsEligible(true);
      setIsCheckingEligibility(false);
    };
    check();
  }, [insuranceId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleFileSelect = (file: File) => {
    setFileError(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.reason || !isEligible) return;
    setFileError(null);
    setSubmitError(null);
    await submitForm(e);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md border border-[#333333] bg-[#0a0a0a] p-6 flex flex-col gap-5 shadow-2xl">
        <ClaimFormHeader coverage={coverage} onCancel={onCancel} />

        {isCheckingEligibility || !isEligible ? (
          <EligibilityState
            isChecking={isCheckingEligibility}
            isEligible={isEligible}
            onCancel={onCancel}
          />
        ) : (
          <ClaimFormFields
            reason={values.reason}
            evidence={values.evidence}
            error={error}
            loading={loading}
            selectedFile={selectedFile}
            filePreview={filePreview}
            onReasonChange={(val) => setFieldValue('reason', val)}
            onEvidenceChange={(val) => setFieldValue('evidence', val)}
            onFileSelect={handleFileSelect}
            onFileError={setFileError}
            onSubmit={handleSubmit}
            onCancel={onCancel}
          />
        )}
      </div>
    </div>
  );
}

export default InsuranceClaimForm;
