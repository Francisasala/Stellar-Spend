import React from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  interactive?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  onActivate?: () => void;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = 'default',
      interactive = false,
      onActivate,
      onClick,
      onKeyDown,
      role,
      tabIndex,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const variantStyles = {
      default: 'bg-white border border-gray-200',
      elevated: 'bg-white shadow-lg',
      outlined: 'bg-transparent border-2 border-gray-300',
    };

    const isInteractive = interactive || Boolean(onActivate) || Boolean(onClick);

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        onActivate?.();
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) {
        return;
      }
      if (
        isInteractive &&
        (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')
      ) {
        event.preventDefault();
        onActivate?.();
      }
    };

    const interactiveProps = isInteractive
      ? {
          role: role ?? 'button',
          tabIndex: tabIndex ?? 0,
          onClick: handleClick,
          onKeyDown: handleKeyDown,
          'aria-label': ariaLabel,
          'aria-labelledby': ariaLabelledBy,
          'aria-describedby': ariaDescribedBy,
        }
      : {
          role,
          tabIndex,
          onClick,
          onKeyDown,
          'aria-label': ariaLabel,
          'aria-labelledby': ariaLabelledBy,
          'aria-describedby': ariaDescribedBy,
        };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg p-6',
          variantStyles[variant],
          isInteractive &&
            'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          className,
        )}
        {...interactiveProps}
        {...props}
      />
    );
  },
);

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mb-4 pb-4 border-b border-gray-200', className)} {...props} />
  ),
);

CardHeader.displayName = 'CardHeader';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('', className)} {...props} />,
);

CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-4 pt-4 border-t border-gray-200', className)} {...props} />
  ),
);

CardFooter.displayName = 'CardFooter';
