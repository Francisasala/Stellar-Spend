import { useState, useCallback, useMemo, FormEvent, ChangeEvent, FocusEvent } from 'react';
import { z } from 'zod';

export interface UseFormOptions<T extends Record<string, unknown>> {
  initialValues: T;
  schema?: z.ZodType<unknown, z.ZodTypeDef, unknown>;
  validate?: (values: T) => Partial<Record<keyof T, string>> | Promise<Partial<Record<keyof T, string>>>;
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
  const [values, setFormValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    return Object.keys(initialValues).some((key) => values[key] !== initialValues[key]);
  }, [values, initialValues]);

  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  const runValidation = useCallback(
    (formValues: T): Partial<Record<keyof T, string>> => {
      let validationErrors: Partial<Record<keyof T, string>> = {};

      if (schema) {
        const result = schema.safeParse(formValues);
        if (!result.success) {
          validationErrors = parseZodErrors<T>(result.error);
        }
      }

      if (customValidate) {
        const customErrors = customValidate(formValues);
        if (customErrors instanceof Promise) {
          // Sync check only for simple pass; async validate should be handled via validate()
        } else if (customErrors) {
          validationErrors = { ...validationErrors, ...customErrors };
        }
      }

      return validationErrors;
    },
    [schema, customValidate],
  );

  const validate = useCallback((): boolean => {
    const validationErrors = runValidation(values);
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  }, [values, runValidation]);

  const validateField = useCallback(
    (field: keyof T): string | undefined => {
      const fieldErrors = runValidation(values);
      const fieldError = fieldErrors[field];
      setErrors((prev) => {
        if (fieldError) {
          return { ...prev, [field]: fieldError };
        }
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
      return fieldError;
    },
    [values, runValidation],
  );

  const setFieldValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setFormValues((prev) => {
        const next = { ...prev, [field]: value };
        if (validateOnChange) {
          const nextErrors = runValidation(next);
          setErrors((prevErrors) => {
            const updated = { ...prevErrors };
            if (nextErrors[field]) {
              updated[field] = nextErrors[field];
            } else {
              delete updated[field];
            }
            return updated;
          });
        }
        return next;
      });
    },
    [validateOnChange, runValidation],
  );

  const setValues = useCallback(
    (newValues: Partial<T> | ((prev: T) => T)) => {
      setFormValues((prev) => {
        const next =
          typeof newValues === 'function' ? newValues(prev) : { ...prev, ...newValues };
        if (validateOnChange) {
          setErrors(runValidation(next));
        }
        return next;
      });
    },
    [validateOnChange, runValidation],
  );

  const setFieldError = useCallback((field: keyof T, error: string | undefined) => {
    setErrors((prev) => {
      if (error) {
        return { ...prev, [field]: error };
      }
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }, []);

  const setFieldTouched = useCallback((field: keyof T, isTouched = true) => {
    setTouched((prev) => ({ ...prev, [field]: isTouched }));
  }, []);

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
          validateField(name as keyof T);
        }
      }
    },
    [setFieldTouched, validateOnBlur, validateField],
  );

  const resetForm = useCallback(
    (newValues?: Partial<T>) => {
      setFormValues(newValues ? ({ ...initialValues, ...newValues } as T) : initialValues);
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
      setSubmitError(null);
    },
    [initialValues],
  );

  const handleSubmit = useCallback(
    async (e?: FormEvent): Promise<boolean> => {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }

      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce((acc, key) => {
        acc[key as keyof T] = true;
        return acc;
      }, {} as Partial<Record<keyof T, boolean>>);
      setTouched(allTouched);

      const validationErrors = runValidation(values);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        onError?.(validationErrors);
        return false;
      }

      if (!onSubmit) {
        onSuccess?.(values);
        return true;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        await onSubmit(values);
        setIsSubmitting(false);
        onSuccess?.(values);
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Form submission failed';
        setSubmitError(errorMsg);
        setIsSubmitting(false);
        onError?.(validationErrors, err);
        return false;
      }
    },
    [values, runValidation, onSubmit, onSuccess, onError],
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

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    submitError,
    setValues,
    setFieldValue,
    setFieldError,
    setErrors,
    setFieldTouched,
    setSubmitError,
    handleChange,
    handleBlur,
    validate,
    validateField,
    handleSubmit,
    resetForm,
    getFieldProps,
  };
}
