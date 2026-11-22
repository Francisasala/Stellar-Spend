import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

/**
 * Single source of truth for button styling (issue #761).
 *
 * All button variants live here as a `cva` definition instead of being
 * re-declared ad hoc per feature. Consumers pick a look through the
 * `variant` / `size` props rather than hand-writing Tailwind classes.
 */
export const buttonVariants = cva(
  'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-400',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  /**
   * Accessible name for icon-only buttons. When provided it is used as the
   * `aria-label` so the control always exposes a name to assistive tech.
   */
  ariaLabel?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading,
      disabled,
      children,
      type = 'button',
      ariaLabel,
      'aria-label': ariaLabelProp,
      'aria-busy': ariaBusy,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;
    const label = ariaLabel ?? ariaLabelProp;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-label={label}
        aria-busy={isLoading ? true : ariaBusy}
        aria-disabled={isDisabled || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {isLoading ? <span aria-hidden="true">...</span> : children}
      </button>
    );
  },
);

Button.displayName = 'Button';
