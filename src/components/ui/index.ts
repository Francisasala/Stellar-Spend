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
export { Skeleton } from './Skeleton';

/**
 * Shared loading/error/empty pattern for list & data views (issue #933).
 * Wrap a data view in `<AsyncBoundary isLoading isEmpty error>` instead of
 * hand-writing a loading/error/empty ternary per page — see the usage
 * example in `AsyncBoundary.tsx`. `ListLoadingState`/`ListEmptyState`/
 * `ListErrorState` are ready-made content for its three slots.
 */
export { AsyncBoundary, ListLoadingState, ListEmptyState, ListErrorState } from '../AsyncBoundary';
export type { AsyncBoundaryProps, ErrorStateProps } from '../AsyncBoundary';
