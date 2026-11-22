import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import { InsuranceClaimForm } from '../InsuranceClaimForm';

vi.mock('@/lib/api/client', () => ({
  apiPatch: vi.fn(),
}));

import { apiPatch } from '@/lib/api/client';

const mockedApiPatch = vi.mocked(apiPatch);

function renderForm(overrides: Partial<React.ComponentProps<typeof InsuranceClaimForm>> = {}) {
  const props = {
    transactionId: 'tx-1',
    // Mock-prefixed id exercises the local claim path (no network call).
    insuranceId: 'ins_test',
    coverage: 250,
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };

  const utils = render(
    <I18nProvider>
      <InsuranceClaimForm {...props} />
    </I18nProvider>,
  );
  return { props, ...utils };
}

async function waitForFormFields() {
  await waitFor(
    () => {
      expect(screen.getByLabelText(/claim reason/i)).toBeInTheDocument();
    },
    { timeout: 4000 },
  );
}

describe('InsuranceClaimForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders as a labelled modal dialog', () => {
    renderForm();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'claim-form-title');
    expect(screen.getByText(/file an insurance claim/i)).toBeInTheDocument();
  });

  it('shows the eligibility check state on mount', () => {
    renderForm();

    expect(screen.getByText(/checking eligibility/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/claim reason/i)).not.toBeInTheDocument();
  });

  it('reveals the claim fields once eligibility resolves', async () => {
    renderForm();

    await waitForFormFields();
    expect(screen.getByLabelText(/claim reason/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/evidence/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /file claim/i })).toBeDisabled();
  });

  it('does not submit while the reason is empty', async () => {
    const { props } = renderForm();
    await waitForFormFields();

    fireEvent.submit(screen.getByRole('form', { name: /file claim/i }));

    expect(props.onSuccess).not.toHaveBeenCalled();
    expect(mockedApiPatch).not.toHaveBeenCalled();
  });

  it('accepts a reason and completes the mock claim flow', async () => {
    const { props } = renderForm();
    await waitForFormFields();

    fireEvent.change(screen.getByLabelText(/claim reason/i), {
      target: { value: 'Other' },
    });

    const submitButton = screen.getByRole('button', { name: /file claim/i });
    expect(submitButton).not.toBeDisabled();
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(props.onSuccess).toHaveBeenCalledWith(expect.stringMatching(/^CLAIM-/));
      },
      { timeout: 4000 },
    );
    expect(mockedApiPatch).not.toHaveBeenCalled();
  });

  it('calls onCancel when Escape is pressed', () => {
    const { props } = renderForm();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(props.onCancel).toHaveBeenCalled();
  });

  it('calls onCancel from the dialog backdrop', () => {
    const { props } = renderForm();

    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);

    expect(props.onCancel).toHaveBeenCalled();
  });
});
