import { cn } from '@/lib/cn';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

export function Label({ className, htmlFor, children, ...props }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('text-xs font-semibold text-[#c9a962] uppercase tracking-widest', className)}
      {...props}
    >
      {children}
    </label>
  );
}
