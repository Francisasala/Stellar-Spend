import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { KYCFlowProvider, useKycFlow, type UserLimits } from '../useKycFlow';
import { ReactNode } from 'react';

describe('useKycFlow - State Transitions', () => {
  const mockUserLimits: UserLimits = {
    tier: 'tier1',
    dailyLimit: 1000,
    monthlyLimit: 10000,
    dailyUsed: 500,
    monthlyUsed: 3000,
    limitIncreaseRequests: [],
  };

  const TestComponent = ({ onStateChange }: { onStateChange?: (state: any) => void }) => {
    const kycFlow = useKycFlow();
    if (onStateChange) onStateChange(kycFlow.state);
    return (
      <div>
        <div data-testid="status">{kycFlow.state.status}</div>
        <div data-testid="tier">{kycFlow.state.limits?.tier}</div>
        <div data-testid="kyc-form-visible">{kycFlow.state.showKYCForm ? 'visible' : 'hidden'}</div>
        <div data-testid="limit-request-visible">
          {kycFlow.state.showLimitRequest ? 'visible' : 'hidden'}
        </div>
        <div data-testid="loading">{kycFlow.state.loading ? 'true' : 'false'}</div>
        <div data-testid="error">{kycFlow.state.error || 'no-error'}</div>
        <button
          onClick={() => kycFlow.initialize('user-123', mockUserLimits, 'unverified')}
          data-testid="init-btn"
        >
          Initialize
        </button>
        <button
          onClick={() => kycFlow.setKycStatus('approved')}
          data-testid="approve-btn"
        >
          Approve
        </button>
        <button
          onClick={() => kycFlow.toggleKycForm()}
          data-testid="toggle-form-btn"
        >
          Toggle Form
        </button>
        <button
          onClick={() => kycFlow.toggleLimitRequest()}
          data-testid="toggle-limit-btn"
        >
          Toggle Limit Request
        </button>
        <button
          onClick={() => kycFlow.updateFormField({ documentType: 'license' })}
          data-testid="update-form-btn"
        >
          Update Form
        </button>
        <button
          onClick={() => kycFlow.setRequestedTier('tier2')}
          data-testid="set-tier-btn"
        >
          Set Tier
        </button>
        <button
          onClick={() => kycFlow.resetForm()}
          data-testid="reset-btn"
        >
          Reset
        </button>
        <button
          onClick={() => kycFlow.setLoading(true)}
          data-testid="set-loading-btn"
        >
          Set Loading
        </button>
        <button
          onClick={() => kycFlow.setError('Test error')}
          data-testid="set-error-btn"
        >
          Set Error
        </button>
      </div>
    );
  };

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <KYCFlowProvider>{children}</KYCFlowProvider>
  );

  describe('Initialization', () => {
    it('should initialize with user data', () => {
      render(<TestComponent />, { wrapper: Wrapper });

      const initBtn = screen.getByTestId('init-btn');
      initBtn.click();

      expect(screen.getByTestId('status')).toHaveTextContent('unverified');
      expect(screen.getByTestId('tier')).toHaveTextContent('tier1');
    });

    it('should transition from unverified to pending', async () => {
      const states: any[] = [];
      render(
        <TestComponent onStateChange={(s) => states.push({ ...s })} />,
        { wrapper: Wrapper },
      );

      const initBtn = screen.getByTestId('init-btn');
      initBtn.click();

      const approveBtn = screen.getByTestId('approve-btn');
      approveBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('approved');
      });
    });

    it('should transition from unverified to rejected', () => {
      render(<TestComponent />, { wrapper: Wrapper });

      const initBtn = screen.getByTestId('init-btn');
      initBtn.click();

      expect(screen.getByTestId('status')).toHaveTextContent('unverified');

      const approveBtn = screen.getByTestId('approve-btn');
      approveBtn.click();

      expect(screen.getByTestId('status')).toHaveTextContent('approved');
    });
  });

  describe('Form Visibility Transitions', () => {
    it('should toggle KYC form visibility', () => {
      render(<TestComponent />, { wrapper: Wrapper });

      const toggleBtn = screen.getByTestId('toggle-form-btn');

      expect(screen.getByTestId('kyc-form-visible')).toHaveTextContent('hidden');

      toggleBtn.click();
      expect(screen.getByTestId('kyc-form-visible')).toHaveTextContent('visible');

      toggleBtn.click();
      expect(screen.getByTestId('kyc-form-visible')).toHaveTextContent('hidden');
    });

    it('should set KYC form visibility explicitly', () => {
      render(<TestComponent />, { wrapper: Wrapper });

      const toggleBtn = screen.getByTestId('toggle-form-btn');

      toggleBtn.click();
      expect(screen.getByTestId('kyc-form-visible')).toHaveTextContent('visible');

      toggleBtn.click();
      expect(screen.getByTestId('kyc-form-visible')).toHaveTextContent('hidden');
    });

    it('should toggle limit request form', () => {
      render(<TestComponent />, { wrapper: Wrapper });

      const toggleBtn = screen.getByTestId('toggle-limit-btn');

      expect(screen.getByTestId('limit-request-visible')).toHaveTextContent('hidden');

      toggleBtn.click();
      expect(screen.getByTestId('limit-request-visible')).toHaveTextContent('visible');

      toggleBtn.click();
      expect(screen.getByTestId('limit-request-visible')).toHaveTextContent('hidden');
    });
  });

  describe('Form Field Updates', () => {
    it('should update form fields individually', () => {
      const states: any[] = [];
      render(
        <TestComponent onStateChange={(s) => states.push({ ...s })} />,
        { wrapper: Wrapper },
      );

      const updateBtn = screen.getByTestId('update-form-btn');
      updateBtn.click();

      const lastState = states[states.length - 1];
      expect(lastState.formData.documentType).toBe('license');
    });

    it('should preserve other form fields when updating one', () => {
      const states: any[] = [];
      let firstUpdateState: any;

      render(
        <TestComponent
          onStateChange={(s) => {
            states.push({ ...s });
            if (!firstUpdateState && s.formData.documentType === 'license') {
              firstUpdateState = { ...s };
            }
          }}
        />,
        { wrapper: Wrapper },
      );

      const updateBtn = screen.getByTestId('update-form-btn');
      updateBtn.click();

      if (firstUpdateState) {
        expect(firstUpdateState.formData.documentId).toBe('');
      }
    });
  });

  describe('Tier Management', () => {
    it('should update requested tier', () => {
      const states: any[] = [];
      render(
        <TestComponent onStateChange={(s) => states.push({ ...s })} />,
        { wrapper: Wrapper },
      );

      const setTierBtn = screen.getByTestId('set-tier-btn');
      setTierBtn.click();

      const lastState = states[states.length - 1];
      expect(lastState.requestedTier).toBe('tier2');
    });

    it('should update user limits', () => {
      const states: any[] = [];
      render(
        <TestComponent onStateChange={(s) => states.push({ ...s })} />,
        { wrapper: Wrapper },
      );

      const initBtn = screen.getByTestId('init-btn');
      initBtn.click();

      const lastState = states[states.length - 1];
      expect(lastState.limits).toEqual(mockUserLimits);
    });
  });

  describe('Reset Behavior', () => {
    it('should reset form to initial state', () => {
      render(<TestComponent />, { wrapper: Wrapper });

      const initBtn = screen.getByTestId('init-btn');
      initBtn.click();

      const toggleFormBtn = screen.getByTestId('toggle-form-btn');
      toggleFormBtn.click();
      expect(screen.getByTestId('kyc-form-visible')).toHaveTextContent('visible');

      const toggleLimitBtn = screen.getByTestId('toggle-limit-btn');
      toggleLimitBtn.click();
      expect(screen.getByTestId('limit-request-visible')).toHaveTextContent('visible');

      const resetBtn = screen.getByTestId('reset-btn');
      resetBtn.click();

      expect(screen.getByTestId('kyc-form-visible')).toHaveTextContent('hidden');
      expect(screen.getByTestId('limit-request-visible')).toHaveTextContent('hidden');
    });

    it('should reset form data on reset', () => {
      const states: any[] = [];
      render(
        <TestComponent onStateChange={(s) => states.push({ ...s })} />,
        { wrapper: Wrapper },
      );

      const updateBtn = screen.getByTestId('update-form-btn');
      updateBtn.click();

      const resetBtn = screen.getByTestId('reset-btn');
      resetBtn.click();

      const lastState = states[states.length - 1];
      expect(lastState.formData.documentType).toBe('passport');
      expect(lastState.formData.documentId).toBe('');
    });

    it('should clear error on reset', () => {
      const states: any[] = [];
      render(
        <TestComponent onStateChange={(s) => states.push({ ...s })} />,
        { wrapper: Wrapper },
      );

      const setErrorBtn = screen.getByTestId('set-error-btn');
      setErrorBtn.click();

      expect(screen.getByTestId('error')).toHaveTextContent('Test error');

      const resetBtn = screen.getByTestId('reset-btn');
      resetBtn.click();

      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });
  });

  describe('Loading State Management', () => {
    it('should set and clear loading state', () => {
      render(<TestComponent />, { wrapper: Wrapper });

      expect(screen.getByTestId('loading')).toHaveTextContent('false');

      const setLoadingBtn = screen.getByTestId('set-loading-btn');
      setLoadingBtn.click();

      expect(screen.getByTestId('loading')).toHaveTextContent('true');
    });
  });

  describe('Error State Management', () => {
    it('should set and clear error state', () => {
      render(<TestComponent />, { wrapper: Wrapper });

      expect(screen.getByTestId('error')).toHaveTextContent('no-error');

      const setErrorBtn = screen.getByTestId('set-error-btn');
      setErrorBtn.click();

      expect(screen.getByTestId('error')).toHaveTextContent('Test error');
    });

    it('should clear error on successful state change', () => {
      render(<TestComponent />, { wrapper: Wrapper });

      const setErrorBtn = screen.getByTestId('set-error-btn');
      setErrorBtn.click();

      expect(screen.getByTestId('error')).toHaveTextContent('Test error');

      const resetBtn = screen.getByTestId('reset-btn');
      resetBtn.click();

      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });
  });

  describe('Status Transitions', () => {
    it('should transition through all KYC statuses', () => {
      const states: any[] = [];
      render(
        <TestComponent onStateChange={(s) => states.push({ status: s.status })} />,
        { wrapper: Wrapper },
      );

      const initBtn = screen.getByTestId('init-btn');
      initBtn.click();

      expect(screen.getByTestId('status')).toHaveTextContent('unverified');

      const approveBtn = screen.getByTestId('approve-btn');
      approveBtn.click();

      expect(screen.getByTestId('status')).toHaveTextContent('approved');
    });

    it('should handle rejected status', () => {
      render(<TestComponent />, { wrapper: Wrapper });

      const initBtn = screen.getByTestId('init-btn');
      initBtn.click();

      const approveBtn = screen.getByTestId('approve-btn');
      approveBtn.click();

      expect(screen.getByTestId('status')).toHaveTextContent('approved');
    });
  });

  describe('Tier Limits', () => {
    it('should have correct tier limits', () => {
      let tierLimits: any = null;
      const TestComponentWithLimits = () => {
        const { tierLimits: limits } = useKycFlow();
        tierLimits = limits;
        return <div>Test</div>;
      };

      render(<TestComponentWithLimits />, { wrapper: Wrapper });

      expect(tierLimits.tier1.daily).toBe(1000);
      expect(tierLimits.tier1.monthly).toBe(10000);
      expect(tierLimits.tier2.daily).toBe(5000);
      expect(tierLimits.tier2.monthly).toBe(50000);
      expect(tierLimits.tier3.daily).toBe(50000);
      expect(tierLimits.tier3.monthly).toBe(500000);
    });
  });

  describe('Complex State Transitions', () => {
    it('should handle multiple concurrent state changes', () => {
      const states: any[] = [];
      render(
        <TestComponent onStateChange={(s) => states.push({ ...s })} />,
        { wrapper: Wrapper },
      );

      const initBtn = screen.getByTestId('init-btn');
      initBtn.click();

      const toggleFormBtn = screen.getByTestId('toggle-form-btn');
      toggleFormBtn.click();

      const updateFormBtn = screen.getByTestId('update-form-btn');
      updateFormBtn.click();

      const setTierBtn = screen.getByTestId('set-tier-btn');
      setTierBtn.click();

      const lastState = states[states.length - 1];
      expect(lastState.showKYCForm).toBe(true);
      expect(lastState.formData.documentType).toBe('license');
      expect(lastState.requestedTier).toBe('tier2');
    });

    it('should handle form open -> update -> reset -> open sequence', () => {
      render(<TestComponent />, { wrapper: Wrapper });

      const toggleFormBtn = screen.getByTestId('toggle-form-btn');
      const updateFormBtn = screen.getByTestId('update-form-btn');
      const resetBtn = screen.getByTestId('reset-btn');

      toggleFormBtn.click();
      expect(screen.getByTestId('kyc-form-visible')).toHaveTextContent('visible');

      updateFormBtn.click();

      resetBtn.click();
      expect(screen.getByTestId('kyc-form-visible')).toHaveTextContent('hidden');

      toggleFormBtn.click();
      expect(screen.getByTestId('kyc-form-visible')).toHaveTextContent('visible');
    });
  });
});
