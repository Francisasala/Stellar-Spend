import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import { ClaimFormHeader } from '../ClaimFormHeader';
import { EligibilityState } from '../EligibilityState';
import { FileUploadZone } from '../FileUploadZone';

describe('InsuranceClaimForm Subcomponents', () => {
  describe('ClaimFormHeader', () => {
    it('renders title and coverage amount', () => {
      const onCancel = vi.fn();
      render(
        <I18nProvider>
          <ClaimFormHeader coverage={250} onCancel={onCancel} />
        </I18nProvider>,
      );

      expect(screen.getByText(/250.00 USDC/)).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText(/close claim form/i));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('EligibilityState', () => {
    it('renders loading spinner when checking', () => {
      render(
        <I18nProvider>
          <EligibilityState isChecking={true} isEligible={null} onCancel={vi.fn()} />
        </I18nProvider>,
      );

      expect(screen.getByText(/checking eligibility/i)).toBeInTheDocument();
    });

    it('renders error message when ineligible', () => {
      render(
        <I18nProvider>
          <EligibilityState isChecking={false} isEligible={false} onCancel={vi.fn()} />
        </I18nProvider>,
      );

      expect(screen.getByText(/ineligible/i)).toBeInTheDocument();
    });
  });

  describe('FileUploadZone', () => {
    it('renders dropzone prompt', () => {
      render(
        <I18nProvider>
          <FileUploadZone
            selectedFile={null}
            filePreview={null}
            onFileSelect={vi.fn()}
            onError={vi.fn()}
          />
        </I18nProvider>,
      );

      expect(screen.getByText(/upload document/i)).toBeInTheDocument();
      expect(screen.getByText(/click to upload/i)).toBeInTheDocument();
    });
  });
});
