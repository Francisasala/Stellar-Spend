'use client';

import { FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { CLAIM_REASONS } from './types';
import { FileUploadZone } from './FileUploadZone';

export interface ClaimFormFieldsProps {
  reason: string;
  evidence: string;
  error?: string | null;
  loading: boolean;
  selectedFile: File | null;
  filePreview: string | null;
  onReasonChange: (reason: string) => void;
  onEvidenceChange: (evidence: string) => void;
  onFileSelect: (file: File) => void;
  onFileError: (err: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

export function ClaimFormFields({
  reason,
  evidence,
  error,
  loading,
  selectedFile,
  filePreview,
  onReasonChange,
  onEvidenceChange,
  onFileSelect,
  onFileError,
  onSubmit,
  onCancel,
}: ClaimFormFieldsProps) {
  const { t } = useI18n();

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="p-2 bg-green-900/10 border border-green-500/30 flex items-center gap-2">
        <span className="text-green-500 text-xs">✓</span>
        <p className="text-[10px] text-green-500 uppercase tracking-widest font-bold">
          {t('insurance.eligible')}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="claim-reason"
          className="text-[10px] tracking-widest uppercase text-[#777777]"
        >
          {t('insurance.claim_reason')} *
        </label>
        <select
          id="claim-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          required
          className={cn(
            'w-full bg-[#111111] border border-[#333333] px-3 py-2.5',
            'text-xs text-white appearance-none cursor-pointer',
            'focus:outline-none focus-border-[#c9a962]',
            'disabled:opacity-50',
          )}
        >
          <option value="">Select a reason...</option>
          {CLAIM_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="claim-evidence"
          className="text-[10px] tracking-widest uppercase text-[#777777]"
        >
          {t('insurance.evidence')}{' '}
          <span className="text-[#555555] normal-case tracking-normal">(optional)</span>
        </label>
        <textarea
          id="claim-evidence"
          value={evidence}
          onChange={(e) => onEvidenceChange(e.target.value)}
          placeholder={t('insurance.evidence_placeholder')}
          rows={3}
          maxLength={2000}
          className={cn(
            'w-full bg-[#111111] border border-[#333333] px-3 py-2.5 resize-none',
            'text-xs text-white placeholder-[#555555]',
            'focus:outline-none focus:border-[#c9a962]',
          )}
        />
      </div>

      <FileUploadZone
        selectedFile={selectedFile}
        filePreview={filePreview}
        onFileSelect={onFileSelect}
        onError={onFileError}
      />

      {error && (
        <div
          role="alert"
          className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400"
        >
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className={cn(
            'flex-1 py-2.5 min-h-[44px] text-[10px] font-bold tracking-widest border border-[#333333]',
            'text-[#777777] bg-transparent transition-colors duration-150',
            'hover:border-[#555555] hover:text-white',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {t('common.cancel').toUpperCase()}
        </button>
        <button
          type="submit"
          disabled={!reason || loading}
          className={cn(
            'flex-1 py-2.5 min-h-[44px] text-[10px] font-bold tracking-widest border',
            !reason || loading
              ? 'border-[#333333] bg-[#222222] text-[#555555] cursor-not-allowed'
              : 'border-[#c9a962] bg-[#c9a962] text-[#0a0a0a] hover:bg-[#e0c07f] hover:border-[#e0c07f]',
            'transition-colors duration-150 shadow-[0_4px_10px_rgba(201,169,98,0.2)]',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]',
          )}
        >
          {loading ? t('common.loading').toUpperCase() : t('insurance.file_claim').toUpperCase()}
        </button>
      </div>
    </form>
  );
}
