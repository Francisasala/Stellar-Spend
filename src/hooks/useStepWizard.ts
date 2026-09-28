import { useState, useCallback } from 'react';

export type WizardStep = 1 | 2 | 3;

export interface UseStepWizardReturn {
  /** Current active step (1-indexed). */
  step: WizardStep;
  /** Navigate to a specific step. */
  goTo: (step: WizardStep) => void;
  /** Move to the next step (no-op if already on last step). */
  next: () => void;
  /** Move to the previous step (no-op if already on first step). */
  back: () => void;
  /** True when on the first step. */
  isFirst: boolean;
  /** True when on the last step. */
  isLast: boolean;
}

/**
 * Shared step-wizard hook for multi-step form flows.
 *
 * Keeps step state local so each wizard instance is independent.
 * The consumer is responsible for validation gating between steps.
 *
 * @param totalSteps - Number of steps in the wizard (default: 3).
 * @param initialStep - Step to start on (default: 1).
 */
export function useStepWizard(
  totalSteps: number = 3,
  initialStep: WizardStep = 1,
): UseStepWizardReturn {
  const [step, setStep] = useState<WizardStep>(initialStep);

  const goTo = useCallback(
    (target: WizardStep) => {
      if (target >= 1 && target <= totalSteps) {
        setStep(target);
      }
    },
    [totalSteps],
  );

  const next = useCallback(() => {
    setStep((s) => (s < totalSteps ? ((s + 1) as WizardStep) : s));
  }, [totalSteps]);

  const back = useCallback(() => {
    setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  }, []);

  return {
    step,
    goTo,
    next,
    back,
    isFirst: step === 1,
    isLast: step === totalSteps,
  };
}
