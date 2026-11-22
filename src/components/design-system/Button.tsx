/**
 * The design-system Button is the single cva-driven Button primitive
 * (see issue #761). It is re-exported here so existing
 * `@/components/design-system` consumers keep working while there is only
 * one Button implementation in the codebase.
 *
 * Accessibility (issue #1435): the re-exported `Button` inherits all ARIA
 * attributes, roles and keyboard behavior from `@/components/ui/Button`.
 * Consumers can pass `aria-label`, `aria-pressed`, `aria-expanded`, etc.
 * through `ButtonProps` unchanged, and native `<button>` semantics provide
 * keyboard activation (Enter/Space) and focus handling out of the box.
 */
export { Button, buttonVariants } from '@/components/ui/Button';
export type { ButtonProps } from '@/components/ui/Button';
