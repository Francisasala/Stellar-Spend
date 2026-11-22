import React from 'react';
import { cn } from '@/lib/cn';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, children, id, ...props }, ref) => {
    const variantStyles = {
      info: 'bg-blue-50 border-l-4 border-blue-500 text-blue-700',
      success: 'bg-green-50 border-l-4 border-green-500 text-green-700',
      warning: 'bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700',
      error: 'bg-red-50 border-l-4 border-red-500 text-red-700',
    };

    const generatedId = React.useId();
    const alertId = id ?? generatedId;
    const titleId = `${alertId}-title`;

    const isUrgent = variant === 'error' || variant === 'warning';
    const role = isUrgent ? 'alert' : 'status';
    const ariaLive = isUrgent ? 'assertive' : 'polite';

    return (
      <div
        ref={ref}
        id={alertId}
        role={role}
        aria-live={ariaLive}
        aria-atomic="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn('p-4 rounded', variantStyles[variant], className)}
        {...props}
      >
        {title && (
          <h3 id={titleId} className="font-semibold mb-1">
            {title}
          </h3>
        )}
        <div>{children}</div>
      </div>
    );
  },
);

Alert.displayName = 'Alert';
