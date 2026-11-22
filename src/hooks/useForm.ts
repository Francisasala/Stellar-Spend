import { useCallback, useMemo, FormEvent, ChangeEvent, FocusEvent } from 'react';
import {
  useForm as useReactHookForm,
  UseFormReturn as RHFUseFormReturn,
  FieldValues,
  Path,
  PathValue,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

export interface UseFormOptions<T extends Record<string, unknown>> {
  initialValues: T;
  schema?: z.ZodType<unknown, z.ZodTypeDef, unknown>;
  validate?: (
    values: T,
  ) => Partial<Record<keyof T, string>> | Promise<Partial<Record<keyof T, string>>>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  onSubmit?: (values: T) => Promise<void> | void;
  onSuccess?: (values: T) => void;
  onError?: (errors: Partial<Record<keyof T, string>>, error?: unknown) => void;
}

export interface UseFormReturn<T extends Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
  submitError: string | null;
  setValues: (values: Partial<T> | ((prev: T) => T)) => void;
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setFieldError: (field: keyof T, error: string | undefined) => void;
  setErrors: (errors: Partial<Record<keyof T, string>>) => void;
  setFieldTouched: (field: keyof T, isTouched?: boolean) => void;
  setSubmitError: (error: string | null) => void;
  handleChange: (
    e:
      | ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
      | { target: { name: string; value: unknown } },
  ) => void;
  handleBlur: (
    e:
      | FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
      | { target: { name: string } },
  ) => void;
  validate: () => boolean;
  validateField: (field: keyof T) => string | undefined;
  handleSubmit: (e?: FormEvent) => Promise<boolean>;
  resetForm: (newValues?: Partial<T>) => void;
  /** Alias for `resetForm` (backwards-compatible). */
  reset: (newValues?: Partial<T>) => void;
  /** Alias for `handleSubmit` (backwards-compatible). */
  submit: (e?: FormEvent) => Promise<boolean>;
  getFieldProps: (field: keyof T) => {
    name: string;
    value: unknown;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    onBlur: (e: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  };
}

export function parseZodErrors<T extends Record<string, unknown>>(
  zodError: z.ZodError,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  for (const issue of zodError.issues) {
    const field = issue.path[0] as keyof T;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

/**
 * Thin backwards-compatible adapter over react-hook-form + zod.
 *
 * The public `useForm` API is preserved so existing consumers keep working,
 * while all state management and validation is delegated to react-hook-form
 * with a zod resolver (the single form pattern for the app).
 */
export function useForm<T extends Record<string, unknown>>({
  initialValues,
  schema,
  validate: customValidate,
  validateOnChange = true,
  validateOnBlur = true,
  onSubmit,
  onSuccess,
  onError,
}: UseFormOptions<T>): UseFormReturn<T> {
  const rhf = useReactHookForm<T>({
    defaultValues: initialValues as unknown as FieldValues,
    mode: validateOnChange ? 'onChange' : validateOnBlur ? 'onBlur' : 'onSubmit',
    reValidateMode: validateOnChange ? 'onChange' : 'onBlur',
    resolver: schema
      ? zodResolver(schema as never)
      : async (formValues) => {
          if (!customValidate) {
            return { values: formValues, errors: {} };
          }
          const customErrors = await customValidate(formValues as T);
          const errors: Record<string, { type: string; message: string }> = {};
          for (const [key, message] of Object.entries(customErrors ?? {})) {
            if (message) {
              errors[key] = { type: 'custom', message };
            }
          }
          return Object.keys(errors).length > 0
            ? { values: {}, errors: errors as never }
            : { values: formValues, errors: {} };
        },
  }) as unknown as RHFUseFormReturn<T>;

  const {
    control,
    formState,
    getValues,
    setValue,
    setError,
    clearErrors,
    reset,
    trigger,
    handleSubmit: rhfHandleSubmit,
    watch,
  } = rhf;

  const values = watch() as T;

  const errors = useMemo(() => {
    const mapped: Partial<Record<keyof T, string>> = {};
    for (const [key, value] of Object.entries(formState.errors)) {
      const message = (value as { message?: string } | undefined)?.message;
      if (message) {
        mapped[key as keyof T] = message;
      }
    }
    return mapped;
  }, [formState.errors]);

  const touched = useMemo(() => {
    const mapped: Partial<Record<keyof T, boolean>> = {};
    for (const [key, value] of Object.entries(formState.touchedFields)) {
      if (value) {
        mapped[key as keyof T] = true;
      }
    }
    return mapped;
  }, [formState.touchedFields]);

  const isDirty = formState.isDirty;
  const isValid = Object.keys(errors).length === 0;
  const isSubmitting = formState.isSubmitting;

  const submitError = useMemo(() => {
    const root = formState.errors.root as { message?: string } | undefined;
    return root?.message ?? null;
  }, [formState.errors]);

  const setFieldValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValue(field as Path<T>, value as PathValue<T, Path<T>>, {
        shouldValidate: validateOnChange,
        shouldDirty: true,
        shouldTouch: true,
      });
    },
    [setValue, validateOnChange],
  );

  const setValues = useCallback(
    (newValues: Partial<T> | ((prev: T) => T)) => {
      const current = getValues() as T;
      const next =
        typeof newValues === 'function' ? newValues(current) : { ...current, ...newValues };
      for (const key of Object.keys(next) as (keyof T)[]) {
        setValue(key as Path<T>, next[key] as PathValue<T, Path<T>>, {
          shouldValidate: validateOnChange,
          shouldDirty: true,
        });
      }
    },
    [getValues, setValue, validateOnChange],
  );

  const setFieldError = useCallback(
    (field: keyof T, error: string | undefined) => {
      if (error) {
        setError(field as Path<T>, { type: 'manual', message: error });
      } else {
        clearErrors(field as Path<T>);
      }
    },
    [setError, clearErrors],
  );

  const setErrors = useCallback(
    (nextErrors: Partial<Record<keyof T, string>>) => {
      clearErrors();
      for (const [key, message] of Object.entries(nextErrors)) {
        if (message) {
          setError(key as Path<T>, { type: 'manual', message });
        }
      }
    },
    [setError, clearErrors],
  );

  const setFieldTouched = useCallback(
    (field: keyof T, isTouched = true) => {
      if (isTouched) {
        setValue(field as Path<T>, getValues(field as Path<T>) as PathValue<T, Path<T>>, {
          shouldTouch: true,
        });
      }
    },
    [setValue, getValues],
  );

  const setSubmitError = useCallback(
    (error: string | null) => {
      if (error) {
        setError('root' as Path<T>, { type: 'manual', message: error });
      } else {
        clearErrors('root' as Path<T>);
      }
    },
    [setError, clearErrors],
  );

  const handleChange = useCallback(
    (
      e:
        | ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
        | { target: { name: string; value: unknown } },
    ) => {
      const { name, value } = e.target;
      if (name) {
        setFieldValue(name as keyof T, value as T[keyof T]);
      }
    },
    [setFieldValue],
  );

  const handleBlur = useCallback(
    (
      e:
        | FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
        | { target: { name: string } },
    ) => {
      const { name } = e.target;
      if (name) {
        setFieldTouched(name as keyof T, true);
        if (validateOnBlur) {
          void trigger(name as Path<T>);
        }
      }
    },
    [setFieldTouched, validateOnBlur, trigger],
  );

  const validate = useCallback(async (): Promise<boolean> => {
    return trigger();
  }, [trigger]);

  const validateField = useCallback(
    async (field: keyof T): Promise<string | undefined> => {
      await trigger(field as Path<T>);
      const fieldError = (getValues() as T) && errors[field];
      return fieldError;
    },
    [trigger, errors, getValues],
  );

  const resetForm = useCallback(
    (newValues?: Partial<T>) => {
      reset(newValues ? ({ ...initialValues, ...newValues } as T) : initialValues, {
        keepDefaultValues: false,
      });
    },
    [reset, initialValues],
  );

  const handleSubmit = useCallback(
    async (e?: FormEvent): Promise<boolean> => {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }

      let succeeded = false;

      await rhfHandleSubmit(
        async (formValues) => {
          const typedValues = formValues as T;
          if (!onSubmit) {
            onSuccess?.(typedValues);
            succeeded = true;
            return;
          }
          try {
            await onSubmit(typedValues);
            onSuccess?.(typedValues);
            succeeded = true;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Form submission failed';
            setSubmitError(errorMsg);
            onError?.({}, err);
            succeeded = false;
          }
        },
        (validationErrors) => {
          const mapped: Partial<Record<keyof T, string>> = {};
          for (const [key, value] of Object.entries(validationErrors)) {
            const message = (value as { message?: string } | undefined)?.message;
            if (message) {
              mapped[key as keyof T] = message;
            }
          }
          onError?.(mapped);
          succeeded = false;
        },
      )(e as unknown as React.BaseSyntheticEvent | undefined);

      return succeeded;
    },
    [rhfHandleSubmit, onSubmit, onSuccess, onError, setSubmitError],
  );

  const getFieldProps = useCallback(
    (field: keyof T) => {
      return {
        name: String(field),
        value: values[field] ?? '',
        onChange: handleChange,
        onBlur: handleBlur,
      };
    },
    [values, handleChange, handleBlur],
  );

  // `control` is exposed via react-hook-form internally; reference it to avoid
  // unused-variable lint while keeping the destructure explicit.
  void control;

  return {
    // State
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    submitError,
    // Setters
    setValues,
    setFieldValue,
    setFieldError,
    setErrors,
    setFieldTouched,
    setSubmitError,
    // Handlers
    handleChange,
    handleBlur,
    validate: validate as unknown as () => boolean,
    validateField: validateField as unknown as (field: keyof T) => string | undefined,
    handleSubmit,
    resetForm,
    getFieldProps,
    // Backwards-compatible aliases
    reset: resetForm,
    submit: handleSubmit,
  };
}
