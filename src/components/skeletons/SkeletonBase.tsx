import { Skeleton } from '@/components/ui/Skeleton';

export interface SkeletonBaseProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  'aria-label'?: string;
}

/**
 * Base skeleton primitive — a thin, backwards-compatible wrapper around the
 * shared `Skeleton` primitive (`@/components/ui/Skeleton`).
 *
 * The pulse + shimmer animation lives once in the `.skeleton` CSS class
 * (`src/app/globals.css`) and already honours `prefers-reduced-motion`.
 * Every skeleton component composes this primitive so there is exactly one
 * shimmer/animation source across the app — no per-component keyframes.
 *
 * Renders as an inline element sized to match its loaded counterpart so no
 * layout shift occurs when data arrives. `pointer-events: none` and
 * `user-select: none` are applied via the `.skeleton` class.
 */
export function SkeletonBase({
  width,
  height,
  className,
  'aria-label': ariaLabel,
}: SkeletonBaseProps) {
  return (
    <Skeleton
      width={width}
      height={height}
      className={className}
      aria-label={ariaLabel ?? 'Loading…'}
    />
  );
}
