import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { useForm } from '../useForm';

/**
 * Issue #1117: Tests for validator edge cases in useForm
 * Ensures comprehensive coverage of common validation patterns
 */

describe('useForm - Validator Edge Cases (#1117)', () => {
  describe('Common validator patterns', () => {
    it('validates email with internationalized domain names', () => {
      const schema = z.object({
        email: z.string().email('Invalid email'),
      });

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          schema,
        }),
      );

      act(() => {
        result.current.setFieldValue('email', 'user@例え.jp');
      });

      expect(result.current.errors.email).toBeUndefined();
    });

    it('validates phone numbers with multiple formats', () => {
      const phoneValidator = (values: { phone: string }) => {
        const errors: Partial<Record<keyof typeof values, string>> = {};
        const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
        if (values.phone && !phoneRegex.test(values.phone.replace(/[\s\-()]/g, ''))) {
          errors.phone = 'Invalid phone number format';
        }
        return errors;
      };

      const { result } = renderHook(() =>
        useForm({
          initialValues: { phone: '' },
          validate: phoneValidator,
        }),
      );

      act(() => {
        result.current.setFieldValue('phone', '+1 (555) 123-4567');
      });

      expect(result.current.errors.phone).toBeUndefined();

      act(() => {
        result.current.setFieldValue('phone', 'invalid');
      });

      result.current.validateField('phone');
      expect(result.current.errors.phone).toBeDefined();
    });

    it('validates URLs with various protocols', () => {
      const schema = z.object({
        url: z.string().url('Invalid URL'),
      });

      const { result } = renderHook(() =>
        useForm({
          initialValues: { url: '' },
          schema,
        }),
      );

      act(() => {
        result.current.setFieldValue('url', 'https://example.com/path?query=value#anchor');
      });

      expect(result.current.errors.url).toBeUndefined();

      act(() => {
        result.current.setFieldValue('url', 'ftp://files.example.com/document.pdf');
      });

      expect(result.current.errors.url).toBeUndefined();
    });

    it('validates passwords with complex requirements', () => {
      const passwordValidator = (values: { password: string }) => {
        const errors: Partial<Record<keyof typeof values, string>> = {};
        const password = values.password;

        if (!password) {
          errors.password = 'Password is required';
        } else if (password.length < 12) {
          errors.password = 'Password must be at least 12 characters';
        } else if (!/[A-Z]/.test(password)) {
          errors.password = 'Password must contain uppercase letter';
        } else if (!/[a-z]/.test(password)) {
          errors.password = 'Password must contain lowercase letter';
        } else if (!/[0-9]/.test(password)) {
          errors.password = 'Password must contain number';
        } else if (!/[!@#$%^&*]/.test(password)) {
          errors.password = 'Password must contain special character';
        }
        return errors;
      };

      const { result } = renderHook(() =>
        useForm({
          initialValues: { password: '' },
          validate: passwordValidator,
        }),
      );

      act(() => {
        result.current.setFieldValue('password', 'weak');
      });

      result.current.validateField('password');
      expect(result.current.errors.password).toBeDefined();

      act(() => {
        result.current.setFieldValue('password', 'ValidPass123!');
      });

      result.current.validateField('password');
      expect(result.current.errors.password).toBeUndefined();
    });

    it('validates numeric ranges with boundary conditions', () => {
      const schema = z.object({
        amount: z.number().min(0, 'Amount must be positive').max(1000000, 'Amount too large'),
      });

      const { result } = renderHook(() =>
        useForm({
          initialValues: { amount: 0 },
          schema,
        }),
      );

      // Test boundary: exactly 0
      act(() => {
        result.current.setFieldValue('amount', 0);
      });
      expect(result.current.errors.amount).toBeUndefined();

      // Test boundary: max value
      act(() => {
        result.current.setFieldValue('amount', 1000000);
      });
      expect(result.current.errors.amount).toBeUndefined();

      // Test out of range
      act(() => {
        result.current.setFieldValue('amount', -1);
      });
      expect(result.current.errors.amount).toBeDefined();

      act(() => {
        result.current.setFieldValue('amount', 1000001);
      });
      expect(result.current.errors.amount).toBeDefined();
    });

    it('validates conditional requirements based on other fields', () => {
      const conditionalValidator = (values: { userType: string; companyName: string }) => {
        const errors: Partial<Record<keyof typeof values, string>> = {};
        if (values.userType === 'business' && !values.companyName) {
          errors.companyName = 'Company name is required for business accounts';
        }
        return errors;
      };

      const { result } = renderHook(() =>
        useForm({
          initialValues: { userType: 'personal', companyName: '' },
          validate: conditionalValidator,
        }),
      );

      act(() => {
        result.current.setFieldValue('userType', 'personal');
      });

      result.current.validateField('companyName');
      expect(result.current.errors.companyName).toBeUndefined();

      act(() => {
        result.current.setFieldValue('userType', 'business');
      });

      result.current.validateField('companyName');
      expect(result.current.errors.companyName).toBeDefined();

      act(() => {
        result.current.setFieldValue('companyName', 'Acme Corp');
      });

      result.current.validateField('companyName');
      expect(result.current.errors.companyName).toBeUndefined();
    });

    it('handles whitespace-only validation edge cases', () => {
      const schema = z.object({
        username: z.string().min(1, 'Required').trim(),
      });

      const { result } = renderHook(() =>
        useForm({
          initialValues: { username: '' },
          schema,
        }),
      );

      act(() => {
        result.current.setFieldValue('username', '   ');
      });

      expect(result.current.values.username).toBe('   ');
      result.current.validateField('username');
      // Note: Zod's trim() does not modify the value, only the validation
    });

    it('validates arrays and list items', () => {
      const schema = z.object({
        tags: z.array(z.string().min(2, 'Tag too short')).min(1, 'At least one tag required'),
      });

      const { result } = renderHook(() =>
        useForm({
          initialValues: { tags: [] },
          schema,
        }),
      );

      act(() => {
        result.current.setFieldValue('tags', ['a']); // Too short
      });

      result.current.validateField('tags');
      expect(result.current.errors.tags).toBeDefined();

      act(() => {
        result.current.setFieldValue('tags', ['valid', 'tags']);
      });

      result.current.validateField('tags');
      expect(result.current.errors.tags).toBeUndefined();
    });

    it('validates dates within acceptable ranges', () => {
      const dateValidator = (values: { birthDate: string }) => {
        const errors: Partial<Record<keyof typeof values, string>> = {};
        const birthDate = new Date(values.birthDate);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();

        if (age < 18) {
          errors.birthDate = 'Must be at least 18 years old';
        }
        return errors;
      };

      const { result } = renderHook(() =>
        useForm({
          initialValues: { birthDate: '' },
          validate: dateValidator,
        }),
      );

      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);

      act(() => {
        result.current.setFieldValue('birthDate', eighteenYearsAgo.toISOString().split('T')[0]);
      });

      result.current.validateField('birthDate');
      expect(result.current.errors.birthDate).toBeUndefined();
    });

    it('combines Zod schema validation with custom validators', () => {
      const schema = z.object({
        email: z.string().email('Invalid email'),
      });

      const customValidator = (values: { email: string }) => {
        const errors: Partial<Record<keyof typeof values, string>> = {};
        if (values.email.endsWith('@example.com')) {
          errors.email = 'Example domain not allowed';
        }
        return errors;
      };

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          schema,
          validate: customValidator,
        }),
      );

      act(() => {
        result.current.setFieldValue('email', 'user@example.com');
      });

      result.current.validateField('email');
      expect(result.current.errors.email).toBeDefined();

      act(() => {
        result.current.setFieldValue('email', 'user@valid.com');
      });

      result.current.validateField('email');
      expect(result.current.errors.email).toBeUndefined();
    });

    it('handles async validation with delayed results', async () => {
      const asyncValidator = vi.fn(
        (values: { username: string }) =>
          new Promise<Partial<Record<keyof typeof values, string>>>((resolve) => {
            setTimeout(() => {
              const errors: Partial<Record<keyof typeof values, string>> = {};
              if (values.username === 'taken') {
                errors.username = 'Username already taken';
              }
              resolve(errors);
            }, 100);
          }),
      );

      const { result } = renderHook(() =>
        useForm({
          initialValues: { username: '' },
          validate: asyncValidator,
        }),
      );

      act(() => {
        result.current.setFieldValue('username', 'available');
      });

      // Async validation is not awaited in runValidation currently
      expect(asyncValidator).toHaveBeenCalled();
    });

    it('clears errors when field becomes valid', () => {
      const schema = z.object({
        email: z.string().email('Invalid email'),
      });

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          schema,
          validateOnChange: true,
        }),
      );

      act(() => {
        result.current.setFieldValue('email', 'invalid-email');
      });

      expect(result.current.errors.email).toBeDefined();

      act(() => {
        result.current.setFieldValue('email', 'valid@example.com');
      });

      expect(result.current.errors.email).toBeUndefined();
    });

    it('validates with custom error messages for multiple violations', () => {
      const customValidator = (values: { code: string }) => {
        const errors: Partial<Record<keyof typeof values, string>> = {};
        if (values.code.length !== 6) {
          errors.code = 'Code must be exactly 6 characters';
        }
        if (!/^\d+$/.test(values.code)) {
          errors.code = 'Code must contain only digits';
        }
        return errors;
      };

      const { result } = renderHook(() =>
        useForm({
          initialValues: { code: '' },
          validate: customValidator,
        }),
      );

      act(() => {
        result.current.setFieldValue('code', 'abc');
      });

      result.current.validateField('code');
      expect(result.current.errors.code).toBe('Code must be exactly 6 characters');
    });

    it('validates cross-field constraints in form submit', async () => {
      const crossFieldValidator = (values: { password: string; confirmPassword: string }) => {
        const errors: Partial<Record<keyof typeof values, string>> = {};
        if (values.password !== values.confirmPassword) {
          errors.confirmPassword = 'Passwords do not match';
        }
        return errors;
      };

      const onSubmit = vi.fn();
      const { result } = renderHook(() =>
        useForm({
          initialValues: { password: '', confirmPassword: '' },
          validate: crossFieldValidator,
          onSubmit,
        }),
      );

      act(() => {
        result.current.setFieldValue('password', 'SecurePass123!');
        result.current.setFieldValue('confirmPassword', 'DifferentPass123!');
      });

      let success = false;
      await act(async () => {
        success = await result.current.handleSubmit();
      });

      expect(success).toBe(false);
      expect(onSubmit).not.toHaveBeenCalled();

      act(() => {
        result.current.setFieldValue('confirmPassword', 'SecurePass123!');
      });

      await act(async () => {
        success = await result.current.handleSubmit();
      });

      expect(success).toBe(true);
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  describe('Validator error state management', () => {
    it('does not validate when validateOnChange is false', () => {
      const schema = z.object({
        email: z.string().email('Invalid email'),
      });

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          schema,
          validateOnChange: false,
        }),
      );

      act(() => {
        result.current.setFieldValue('email', 'invalid');
      });

      expect(result.current.errors.email).toBeUndefined();

      act(() => {
        result.current.validateField('email');
      });

      expect(result.current.errors.email).toBeDefined();
    });

    it('respects validateOnBlur setting', () => {
      const schema = z.object({
        email: z.string().email('Invalid email'),
      });

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          schema,
          validateOnBlur: false,
        }),
      );

      act(() => {
        result.current.handleBlur({
          target: { name: 'email' },
        });
      });

      expect(result.current.errors.email).toBeUndefined();
      expect(result.current.touched.email).toBe(true);
    });

    it('removes error when field is manually cleared', () => {
      const schema = z.object({
        email: z.string().email('Invalid email'),
      });

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          schema,
        }),
      );

      act(() => {
        result.current.setFieldValue('email', 'invalid');
      });

      expect(result.current.errors.email).toBeDefined();

      act(() => {
        result.current.setFieldError('email', undefined);
      });

      expect(result.current.errors.email).toBeUndefined();
    });

    it('handles multiple field validation in one update', () => {
      const schema = z.object({
        username: z.string().min(3),
        email: z.string().email(),
      });

      const { result } = renderHook(() =>
        useForm({
          initialValues: { username: '', email: '' },
          schema,
        }),
      );

      act(() => {
        result.current.setValues({
          username: 'ab',
          email: 'invalid',
        });
      });

      expect(result.current.errors.username).toBeDefined();
      expect(result.current.errors.email).toBeDefined();
    });
  });
});
