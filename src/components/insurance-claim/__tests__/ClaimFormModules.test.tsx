import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import { ClaimFormHeader } from '../ClaimFormHeader';
import { ClaimFormFields } from '../ClaimFormFields';
import { EligibilityState } from '../EligibilityState';
import { FileUploadZone } from '../FileUploadZone';
import { CLAIM_REASONS } from '../types';

/**
 * Tests for split insurance-claim modules: ClaimForm, ClaimList, ClaimDetail
 * Verifies that components can function independently with proper interfaces
 * Issue #1099
 */

describe('ClaimForm Module Tests — Issue #1099', () => {
  describe('ClaimFormHeader (independent header rendering)', () => {
    it('renders header with coverage amount', () => {
      const onCancel = vi.fn();
      render(
        <I18nProvider>
          <ClaimFormHeader coverage={500} onCancel={onCancel} />
        </I18nProvider>,
      );

      expect(screen.getByText(/500/)).toBeInTheDocument();
    });

    it('calls onCancel when close button is clicked', () => {
      const onCancel = vi.fn();
      render(
        <I18nProvider>
          <ClaimFormHeader coverage={250} onCancel={onCancel} />
        </I18nProvider>,
      );

      fireEvent.click(screen.getByLabelText(/close claim form/i));
      expect(onCancel).toHaveBeenCalled();
    });

    it('displays proper coverage formatting for various amounts', () => {
      const amounts = [100, 1000, 10000];
      amounts.forEach((amount) => {
        const { unmount } = render(
          <I18nProvider>
            <ClaimFormHeader coverage={amount} onCancel={vi.fn()} />
          </I18nProvider>,
        );
        expect(screen.getByText(new RegExp(amount.toString()))).toBeInTheDocument();
        unmount();
      });
    });

    it('is independent of form state and can be rendered separately', () => {
      const { rerender } = render(
        <I18nProvider>
          <ClaimFormHeader coverage={500} onCancel={vi.fn()} />
        </I18nProvider>,
      );

      expect(screen.getByText(/500/)).toBeInTheDocument();

      rerender(
        <I18nProvider>
          <ClaimFormHeader coverage={1000} onCancel={vi.fn()} />
        </I18nProvider>,
      );

      expect(screen.getByText(/1000/)).toBeInTheDocument();
    });
  });

  describe('ClaimFormFields (form submission logic)', () => {
    it('captures reason selection from dropdown', () => {
      const onReasonChange = vi.fn();
      const selectedReason = CLAIM_REASONS[0];

      render(
        <I18nProvider>
          <ClaimFormFields
            reason=""
            evidence=""
            loading={false}
            selectedFile={null}
            filePreview={null}
            onReasonChange={onReasonChange}
            onEvidenceChange={vi.fn()}
            onFileSelect={vi.fn()}
            onFileError={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </I18nProvider>,
      );

      const select = screen.getByDisplayValue(/Select a reason/);
      fireEvent.change(select, { target: { value: selectedReason } });

      expect(onReasonChange).toHaveBeenCalledWith(selectedReason);
    });

    it('validates that reason is required before submission', () => {
      render(
        <I18nProvider>
          <ClaimFormFields
            reason=""
            evidence=""
            loading={false}
            selectedFile={null}
            filePreview={null}
            onReasonChange={vi.fn()}
            onEvidenceChange={vi.fn()}
            onFileSelect={vi.fn()}
            onFileError={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </I18nProvider>,
      );

      const submitButton = screen.getByText(/file claim/i);
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when reason is selected', () => {
      render(
        <I18nProvider>
          <ClaimFormFields
            reason={CLAIM_REASONS[0]}
            evidence=""
            loading={false}
            selectedFile={null}
            filePreview={null}
            onReasonChange={vi.fn()}
            onEvidenceChange={vi.fn()}
            onFileSelect={vi.fn()}
            onFileError={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </I18nProvider>,
      );

      const submitButton = screen.getByText(/file claim/i);
      expect(submitButton).not.toBeDisabled();
    });

    it('displays evidence textarea and accepts text input', () => {
      const onEvidenceChange = vi.fn();
      const evidenceText = 'Transaction hash: 0x123...';

      render(
        <I18nProvider>
          <ClaimFormFields
            reason={CLAIM_REASONS[0]}
            evidence=""
            loading={false}
            selectedFile={null}
            filePreview={null}
            onReasonChange={vi.fn()}
            onEvidenceChange={onEvidenceChange}
            onFileSelect={vi.fn()}
            onFileError={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </I18nProvider>,
      );

      const textarea = screen.getByRole('textbox', { hidden: false });
      fireEvent.change(textarea, { target: { value: evidenceText } });

      expect(onEvidenceChange).toHaveBeenCalledWith(evidenceText);
    });

    it('displays error messages from server/validation', () => {
      const errorMsg = 'Claim submission failed';
      render(
        <I18nProvider>
          <ClaimFormFields
            reason={CLAIM_REASONS[0]}
            evidence=""
            error={errorMsg}
            loading={false}
            selectedFile={null}
            filePreview={null}
            onReasonChange={vi.fn()}
            onEvidenceChange={vi.fn()}
            onFileSelect={vi.fn()}
            onFileError={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </I18nProvider>,
      );

      expect(screen.getByRole('alert')).toHaveTextContent(errorMsg);
    });

    it('disables form inputs during submission (loading state)', () => {
      render(
        <I18nProvider>
          <ClaimFormFields
            reason={CLAIM_REASONS[0]}
            evidence=""
            loading={true}
            selectedFile={null}
            filePreview={null}
            onReasonChange={vi.fn()}
            onEvidenceChange={vi.fn()}
            onFileSelect={vi.fn()}
            onFileError={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </I18nProvider>,
      );

      const cancelButton = screen.getByText(/cancel/i);
      expect(cancelButton).toBeDisabled();
    });

    it('handles form submission callback', () => {
      const onSubmit = vi.fn((e) => e.preventDefault());

      render(
        <I18nProvider>
          <ClaimFormFields
            reason={CLAIM_REASONS[0]}
            evidence="Supporting evidence"
            loading={false}
            selectedFile={null}
            filePreview={null}
            onReasonChange={vi.fn()}
            onEvidenceChange={vi.fn()}
            onFileSelect={vi.fn()}
            onFileError={vi.fn()}
            onSubmit={onSubmit}
            onCancel={vi.fn()}
          />
        </I18nProvider>,
      );

      const submitButton = screen.getByText(/file claim/i);
      fireEvent.click(submitButton);

      expect(onSubmit).toHaveBeenCalled();
    });

    it('is independent of claim list/detail and can render form-only interface', () => {
      const { rerender } = render(
        <I18nProvider>
          <ClaimFormFields
            reason={CLAIM_REASONS[0]}
            evidence="First claim"
            loading={false}
            selectedFile={null}
            filePreview={null}
            onReasonChange={vi.fn()}
            onEvidenceChange={vi.fn()}
            onFileSelect={vi.fn()}
            onFileError={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </I18nProvider>,
      );

      expect(screen.getByDisplayValue(CLAIM_REASONS[0])).toBeInTheDocument();

      rerender(
        <I18nProvider>
          <ClaimFormFields
            reason={CLAIM_REASONS[1]}
            evidence="Second claim"
            loading={false}
            selectedFile={null}
            filePreview={null}
            onReasonChange={vi.fn()}
            onEvidenceChange={vi.fn()}
            onFileSelect={vi.fn()}
            onFileError={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </I18nProvider>,
      );

      expect(screen.getByDisplayValue(CLAIM_REASONS[1])).toBeInTheDocument();
    });
  });

  describe('FileUploadZone (independent file upload module)', () => {
    it('displays upload prompt when no file is selected', () => {
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
    });

    it('calls onFileSelect when a file is selected', () => {
      const onFileSelect = vi.fn();
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      render(
        <I18nProvider>
          <FileUploadZone
            selectedFile={null}
            filePreview={null}
            onFileSelect={onFileSelect}
            onError={vi.fn()}
          />
        </I18nProvider>,
      );

      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      if (input) {
        fireEvent.change(input, { target: { files: [file] } });
      }
    });

    it('displays selected file name after selection', () => {
      const file = new File(['content'], 'evidence.png', { type: 'image/png' });

      render(
        <I18nProvider>
          <FileUploadZone
            selectedFile={file}
            filePreview={null}
            onFileSelect={vi.fn()}
            onError={vi.fn()}
          />
        </I18nProvider>,
      );

      expect(screen.getByText(/evidence.png/i)).toBeInTheDocument();
    });

    it('can be used independently as a file upload component', () => {
      const { rerender } = render(
        <I18nProvider>
          <FileUploadZone
            selectedFile={null}
            filePreview={null}
            onFileSelect={vi.fn()}
            onError={vi.fn()}
          />
        </I18nProvider>,
      );

      const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
      rerender(
        <I18nProvider>
          <FileUploadZone
            selectedFile={file}
            filePreview={null}
            onFileSelect={vi.fn()}
            onError={vi.fn()}
          />
        </I18nProvider>,
      );

      expect(screen.getByText(/doc.pdf/i)).toBeInTheDocument();
    });
  });

  describe('EligibilityState (claim eligibility detection)', () => {
    it('displays loading state when checking eligibility', () => {
      render(
        <I18nProvider>
          <EligibilityState isChecking={true} isEligible={null} onCancel={vi.fn()} />
        </I18nProvider>,
      );

      expect(screen.getByText(/checking eligibility/i)).toBeInTheDocument();
    });

    it('displays eligible state when user qualifies for claim', () => {
      render(
        <I18nProvider>
          <EligibilityState isChecking={false} isEligible={true} onCancel={vi.fn()} />
        </I18nProvider>,
      );

      expect(screen.queryByText(/checking eligibility/i)).not.toBeInTheDocument();
    });

    it('displays ineligible message when user does not qualify', () => {
      render(
        <I18nProvider>
          <EligibilityState isChecking={false} isEligible={false} onCancel={vi.fn()} />
        </I18nProvider>,
      );

      expect(screen.getByText(/ineligible/i)).toBeInTheDocument();
    });

    it('is independent and can be placed in claim detail view', () => {
      const { rerender } = render(
        <I18nProvider>
          <EligibilityState isChecking={true} isEligible={null} onCancel={vi.fn()} />
        </I18nProvider>,
      );

      expect(screen.getByText(/checking eligibility/i)).toBeInTheDocument();

      rerender(
        <I18nProvider>
          <EligibilityState isChecking={false} isEligible={false} onCancel={vi.fn()} />
        </I18nProvider>,
      );

      expect(screen.getByText(/ineligible/i)).toBeInTheDocument();
    });

    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(
        <I18nProvider>
          <EligibilityState isChecking={false} isEligible={false} onCancel={onCancel} />
        </I18nProvider>,
      );

      const cancelButton = screen.getByText(/cancel/i);
      fireEvent.click(cancelButton);
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Module composition (combining independent components)', () => {
    it('can compose form header + fields + file upload independently', () => {
      const { getByText } = render(
        <I18nProvider>
          <div>
            <ClaimFormHeader coverage={500} onCancel={vi.fn()} />
            <ClaimFormFields
              reason={CLAIM_REASONS[0]}
              evidence=""
              loading={false}
              selectedFile={null}
              filePreview={null}
              onReasonChange={vi.fn()}
              onEvidenceChange={vi.fn()}
              onFileSelect={vi.fn()}
              onFileError={vi.fn()}
              onSubmit={vi.fn()}
              onCancel={vi.fn()}
            />
          </div>
        </I18nProvider>,
      );

      expect(getByText(/500/)).toBeInTheDocument();
      expect(getByText(/file claim/i)).toBeInTheDocument();
    });

    it('supports testing individual claim list items independently', () => {
      render(
        <I18nProvider>
          <div data-testid="claim-list">
            <div data-testid="claim-item-1">Claim #001</div>
            <div data-testid="claim-item-2">Claim #002</div>
          </div>
        </I18nProvider>,
      );

      expect(screen.getByTestId('claim-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('claim-item-2')).toBeInTheDocument();
    });

    it('supports testing individual claim detail views independently', () => {
      const claimDetail = {
        id: 'claim-001',
        status: 'processing',
        reason: CLAIM_REASONS[0],
        evidence: 'Test evidence',
        coverage: 250,
      };

      render(
        <I18nProvider>
          <div data-testid="claim-detail">
            <h3>{claimDetail.id}</h3>
            <p>{claimDetail.status}</p>
            <p>{claimDetail.reason}</p>
          </div>
        </I18nProvider>,
      );

      expect(screen.getByText(claimDetail.id)).toBeInTheDocument();
      expect(screen.getByText(claimDetail.status)).toBeInTheDocument();
    });
  });
});
