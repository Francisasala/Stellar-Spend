/**
 * UI primitives public API.
 *
 * `Button` and `Input` are the single, variant-driven primitives (issue #761):
 * pick a look via the `variant` / `size` (Button) or `variant` / `inputSize`
 * (Input) props instead of hand-writing Tailwind classes per feature.
 * Explicit exports only — no `export *`.
 */

export { Button, buttonVariants } from './Button';
export type { ButtonProps } from './Button';

export { Input, inputVariants } from './Input';
export type { InputProps } from './Input';

export { Label } from './Label';

/**
 * Shared loading/empty-state primitives (issue #1441).
 * `Skeleton` is the single loading placeholder; `Empty` is the single
 * empty-state component. Use these instead of one-off implementations.
 */
export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { Empty } from './Empty';
export type { EmptyProps } from './Empty';

/**
 * Shared loading/error/empty pattern for list & data views (issue #933).
 * Wrap a data view in `<AsyncBoundary isLoading isEmpty error>` instead of
 * hand-writing a loading/error/empty ternary per page — see the usage
 * example in `AsyncBoundary.tsx`. `ListLoadingState`/`ListEmptyState`/
 * `ListErrorState` are ready-made content for its three slots.
 */
export { AsyncBoundary, ListLoadingState, ListEmptyState, ListErrorState } from '../AsyncBoundary';
export type { AsyncBoundaryProps, ErrorStateProps } from '../AsyncBoundary';
