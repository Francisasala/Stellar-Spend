/**
 * Centralized responsive breakpoint tokens.
 * CSS custom properties are defined in src/app/globals.css @theme inline.
 * Use the Tailwind class constants below instead of ad-hoc breakpoint strings.
 */
export const bpClasses = {
  /** Flex direction override on narrow viewports (<=720 px) */
  headerCollapseFlexCol: 'max-[720px]:flex-col',
  /** Align-items override on narrow viewports (<=720 px) */
  headerCollapseItemsStart: 'max-[720px]:items-start',
  /** Two-column grid layout at the md breakpoint (>=768 px) */
  gridTwoCols: 'md:grid-cols-2',
  /** Hidden on mobile, visible from sm breakpoint (>=640 px) */
  hiddenBelowSm: 'hidden sm:inline',
} as const;

/** Raw media-query strings for use in JS / matchMedia calls. */
export const breakpoints = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  headerCollapse: '(max-width: 720px)',
} as const;
