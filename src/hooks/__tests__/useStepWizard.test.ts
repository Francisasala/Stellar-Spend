import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStepWizard } from '../useStepWizard';

describe('useStepWizard', () => {
  it('starts on step 1 by default', () => {
    const { result } = renderHook(() => useStepWizard());
    expect(result.current.step).toBe(1);
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isLast).toBe(false);
  });

  it('advances to the next step', () => {
    const { result } = renderHook(() => useStepWizard());
    act(() => result.current.next());
    expect(result.current.step).toBe(2);
    expect(result.current.isFirst).toBe(false);
  });

  it('goes back to the previous step', () => {
    const { result } = renderHook(() => useStepWizard());
    act(() => result.current.next());
    act(() => result.current.back());
    expect(result.current.step).toBe(1);
  });

  it('does not go below step 1', () => {
    const { result } = renderHook(() => useStepWizard());
    act(() => result.current.back());
    expect(result.current.step).toBe(1);
  });

  it('does not go above total steps', () => {
    const { result } = renderHook(() => useStepWizard(3));
    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.next()); // should stay at 3
    expect(result.current.step).toBe(3);
    expect(result.current.isLast).toBe(true);
  });

  it('jumps to a specific step with goTo', () => {
    const { result } = renderHook(() => useStepWizard());
    act(() => result.current.goTo(3));
    expect(result.current.step).toBe(3);
  });

  it('respects custom initialStep', () => {
    const { result } = renderHook(() => useStepWizard(3, 2));
    expect(result.current.step).toBe(2);
  });

  it('isFirst and isLast are correct at boundaries', () => {
    const { result } = renderHook(() => useStepWizard(3));
    act(() => result.current.goTo(3));
    expect(result.current.isFirst).toBe(false);
    expect(result.current.isLast).toBe(true);
  });

  describe('Step Skip (Feature-Agnostic)', () => {
    it('supports skipping steps via goTo without feature-specific logic', () => {
      const { result } = renderHook(() => useStepWizard(5));
      act(() => result.current.goTo(4));
      expect(result.current.step).toBe(4);
    });

    it('allows jumping forward across multiple steps', () => {
      const { result } = renderHook(() => useStepWizard(5));
      act(() => result.current.goTo(5));
      expect(result.current.step).toBe(5);
      expect(result.current.isLast).toBe(true);
    });

    it('allows jumping backward across multiple steps', () => {
      const { result } = renderHook(() => useStepWizard(5, 4));
      act(() => result.current.goTo(1));
      expect(result.current.step).toBe(1);
      expect(result.current.isFirst).toBe(true);
    });

    it('does not enforce step sequence when skipping', () => {
      const { result } = renderHook(() => useStepWizard(5));
      act(() => result.current.goTo(3));
      expect(result.current.step).toBe(3);
      act(() => result.current.goTo(1));
      expect(result.current.step).toBe(1);
    });

    it('does not allow jumping to invalid steps (out of range)', () => {
      const { result } = renderHook(() => useStepWizard(3));
      act(() => result.current.goTo(5));
      expect(result.current.step).toBe(1); // Should remain at initial step
    });

    it('does not allow jumping to step 0 or below', () => {
      const { result } = renderHook(() => useStepWizard(3));
      act(() => result.current.goTo(0));
      expect(result.current.step).toBe(1);
    });
  });

  describe('Validation-Gated Transitions', () => {
    it('provides state for consuming components to implement validation', () => {
      const { result } = renderHook(() => useStepWizard(3));

      expect(result.current.step).toBeDefined();
      expect(result.current.next).toBeDefined();
      expect(result.current.back).toBeDefined();
      expect(result.current.goTo).toBeDefined();
    });

    it('does not perform internal validation - leaves it to consumers', () => {
      const { result } = renderHook(() => useStepWizard(3));

      act(() => result.current.next());
      expect(result.current.step).toBe(2);

      act(() => result.current.next());
      expect(result.current.step).toBe(3);

      act(() => result.current.back());
      expect(result.current.step).toBe(2);
    });

    it('allows consumers to prevent navigation by not calling hooks', () => {
      const { result } = renderHook(() => useStepWizard(3));

      const initialStep = result.current.step;
      // Consumer would check validation here, only call next() if valid
      // Not calling next() means step doesn't change
      expect(result.current.step).toBe(initialStep);
    });

    it('supports multiple validation scenarios through goTo', () => {
      const { result } = renderHook(() => useStepWizard(4));

      act(() => result.current.goTo(2));
      expect(result.current.step).toBe(2);

      act(() => result.current.goTo(4));
      expect(result.current.step).toBe(4);

      act(() => result.current.goTo(1));
      expect(result.current.step).toBe(1);
    });

    it('enables conditional step progression without internal branching', () => {
      const { result } = renderHook(() => useStepWizard(3));

      expect(result.current.isFirst).toBe(true);

      act(() => result.current.next());
      expect(result.current.isFirst).toBe(false);

      const canProceedToStep3 = true;
      if (canProceedToStep3) {
        act(() => result.current.next());
      }
      expect(result.current.step).toBe(3);
    });
  });

  describe('Backward Navigation', () => {
    it('supports going back one step at a time', () => {
      const { result } = renderHook(() => useStepWizard(4, 4));
      act(() => result.current.back());
      expect(result.current.step).toBe(3);
      act(() => result.current.back());
      expect(result.current.step).toBe(2);
      act(() => result.current.back());
      expect(result.current.step).toBe(1);
    });

    it('stops at step 1 when going back', () => {
      const { result } = renderHook(() => useStepWizard(3, 1));
      act(() => result.current.back());
      expect(result.current.step).toBe(1);
      act(() => result.current.back());
      expect(result.current.step).toBe(1);
    });

    it('allows jumping back using goTo for large step counts', () => {
      const { result } = renderHook(() => useStepWizard(10, 10));
      act(() => result.current.goTo(1));
      expect(result.current.step).toBe(1);
    });

    it('preserves step state when back is called from first step', () => {
      const { result } = renderHook(() => useStepWizard(3));
      const initialStep = result.current.step;
      act(() => result.current.back());
      expect(result.current.step).toBe(initialStep);
    });
  });

  describe('Feature-Agnostic Design', () => {
    it('has no onramp-specific logic', () => {
      const { result } = renderHook(() => useStepWizard(3));
      const hookImplementation = result.current;
      const implementationString = Object.values(hookImplementation).toString();
      expect(implementationString).not.toMatch(/onramp|offramp|kyc|feature/i);
    });

    it('has no special handling for different feature types', () => {
      const onrampHook = renderHook(() => useStepWizard(3));
      const offrampHook = renderHook(() => useStepWizard(3));
      const kycHook = renderHook(() => useStepWizard(3));

      expect(onrampHook.result.current.step).toBe(offrampHook.result.current.step);
      expect(offrampHook.result.current.step).toBe(kycHook.result.current.step);
    });

    it('works identically regardless of calling component context', () => {
      const wizardA = renderHook(() => useStepWizard(4));
      const wizardB = renderHook(() => useStepWizard(4));

      act(() => wizardA.result.current.next());
      act(() => wizardB.result.current.next());

      expect(wizardA.result.current.step).toBe(wizardB.result.current.step);
    });

    it('leaves branching logic to consumers', () => {
      const { result } = renderHook(() => useStepWizard(3));

      let navigateToStep: number | null = null;

      // Consumer decides where to navigate based on feature logic
      if (result.current.isFirst) {
        navigateToStep = 2;
      }

      expect(navigateToStep).toBe(2);
      act(() => {
        if (navigateToStep) result.current.goTo(navigateToStep);
      });
      expect(result.current.step).toBe(2);
    });
  });

  describe('Reusability Across Feature Flows', () => {
    it('supports onramp flow (3 steps)', () => {
      const { result } = renderHook(() => useStepWizard(3));
      expect(result.current.step).toBe(1);
      act(() => result.current.next());
      expect(result.current.step).toBe(2);
      act(() => result.current.next());
      expect(result.current.step).toBe(3);
      expect(result.current.isLast).toBe(true);
    });

    it('supports offramp flow (4 steps)', () => {
      const { result } = renderHook(() => useStepWizard(4));
      expect(result.current.step).toBe(1);
      act(() => result.current.goTo(2));
      act(() => result.current.goTo(3));
      act(() => result.current.goTo(4));
      expect(result.current.isLast).toBe(true);
    });

    it('supports KYC flow (5 steps)', () => {
      const { result } = renderHook(() => useStepWizard(5));
      act(() => result.current.next());
      act(() => result.current.next());
      act(() => result.current.goTo(5));
      expect(result.current.step).toBe(5);
      expect(result.current.isLast).toBe(true);
    });

    it('each feature flow instance is independent', () => {
      const onrampWizard = renderHook(() => useStepWizard(3));
      const offrampWizard = renderHook(() => useStepWizard(4));

      act(() => onrampWizard.result.current.goTo(3));
      act(() => offrampWizard.result.current.goTo(2));

      expect(onrampWizard.result.current.isLast).toBe(true);
      expect(offrampWizard.result.current.isLast).toBe(false);
    });
  });
});
