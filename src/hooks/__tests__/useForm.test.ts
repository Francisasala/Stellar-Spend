import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { useForm, parseZodErrors } from '../useForm';

const testSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  age: z.number().min(18, 'Must be at least 18'),
});

describe('useForm Hook', () => {
  it('initializes with default values', () => {
    const initialValues = { username: '', email: '', age: 0 };
    const { result } = renderHook(() =>
      useForm({
        initialValues,
        schema: testSchema,
      }),
    );

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isValid).toBe(true);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.submitError).toBeNull();
  });

  it('updates form values and marks as dirty on setFieldValue', () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { username: '', email: '', age: 0 },
      }),
    );

    act(() => {
      result.current.setFieldValue('username', 'alice');
    });

    expect(result.current.values.username).toBe('alice');
    expect(result.current.isDirty).toBe(true);
  });

  it('handles field change events through handleChange', () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { username: '', email: '' },
      }),
    );

    act(() => {
      result.current.handleChange({
        target: { name: 'email', value: 'test@example.com' },
      });
    });

    expect(result.current.values.email).toBe('test@example.com');
  });

  it('validates fields against Zod schema on change', () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { username: '', email: '', age: 20 },
        schema: testSchema,
        validateOnChange: true,
      }),
    );

    act(() => {
      result.current.setFieldValue('username', 'al');
    });

    expect(result.current.errors.username).toBe('Username must be at least 3 characters');
    expect(result.current.isValid).toBe(false);

    act(() => {
      result.current.setFieldValue('username', 'alice');
    });

    expect(result.current.errors.username).toBeUndefined();
  });

  it('handles blur and marks field as touched', () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { username: '', email: '' },
        schema: testSchema,
      }),
    );

    act(() => {
      result.current.handleBlur({
        target: { name: 'username' },
      });
    });

    expect(result.current.touched.username).toBe(true);
    expect(result.current.errors.username).toBe('Username must be at least 3 characters');
  });

  it('runs validation on form submit and blocks if invalid', async () => {
    const onSubmit = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useForm({
        initialValues: { username: '', email: 'invalid-email', age: 10 },
        schema: testSchema,
        onSubmit,
        onError,
      }),
    );

    let success = false;
    await act(async () => {
      success = await result.current.handleSubmit();
    });

    expect(success).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
    expect(result.current.touched.username).toBe(true);
    expect(result.current.touched.email).toBe(true);
    expect(result.current.touched.age).toBe(true);
    expect(result.current.errors.username).toBeDefined();
    expect(result.current.errors.email).toBeDefined();
  });

  it('submits successfully when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useForm({
        initialValues: { username: 'alice', email: 'alice@example.com', age: 25 },
        schema: testSchema,
        onSubmit,
        onSuccess,
      }),
    );

    let success = false;
    await act(async () => {
      success = await result.current.handleSubmit();
    });

    expect(success).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      age: 25,
    });
    expect(onSuccess).toHaveBeenCalled();
    expect(result.current.submitError).toBeNull();
  });

  it('captures submit error when onSubmit throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useForm({
        initialValues: { username: 'alice', email: 'alice@example.com', age: 25 },
        schema: testSchema,
        onSubmit,
        onError,
      }),
    );

    let success = true;
    await act(async () => {
      success = await result.current.handleSubmit();
    });

    expect(success).toBe(false);
    expect(result.current.submitError).toBe('Network error');
    expect(onError).toHaveBeenCalled();
  });

  it('resets form to initial values or custom values with resetForm', () => {
    const initialValues = { username: 'alice', email: 'alice@example.com', age: 25 };
    const { result } = renderHook(() =>
      useForm({
        initialValues,
        schema: testSchema,
      }),
    );

    act(() => {
      result.current.setFieldValue('username', 'bob');
      result.current.setFieldError('username', 'Custom error');
      result.current.setFieldTouched('username', true);
    });

    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.resetForm();
    });

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isDirty).toBe(false);
  });

  it('provides helper props via getFieldProps', () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { username: 'testuser' },
      }),
    );

    const props = result.current.getFieldProps('username');
    expect(props.name).toBe('username');
    expect(props.value).toBe('testuser');
    expect(typeof props.onChange).toBe('function');
    expect(typeof props.onBlur).toBe('function');
  });

  it('parses Zod errors into a flat record with parseZodErrors', () => {
    const parsed = testSchema.safeParse({ username: 'a', email: 'bad', age: 10 });
    if (!parsed.success) {
      const errMap = parseZodErrors(parsed.error);
      expect(errMap.username).toBe('Username must be at least 3 characters');
      expect(errMap.email).toBe('Invalid email address');
      expect(errMap.age).toBe('Must be at least 18');
    }
  });
});
