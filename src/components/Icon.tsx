import type { ReactNode } from 'react';

/**
 * Single source of truth for the app's inline icon set. Every icon previously
 * duplicated as ad-hoc `<svg>` markup across components (close, chevron,
 * alert/check circles, bell, copy) is defined once here and rendered by name.
 */
export type IconName =
  | 'close'
  | 'chevron-down'
  | 'chevron-right'
  | 'alert-circle'
  | 'check-circle'
  | 'bell'
  | 'copy'
  | 'copy-check';

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const VIEW_BOX: Record<IconName, string> = {
  close: '0 0 16 16',
  'chevron-down': '0 0 24 24',
  'chevron-right': '0 0 16 16',
  'alert-circle': '0 0 16 16',
  'check-circle': '0 0 16 16',
  bell: '0 0 24 24',
  copy: '0 0 16 16',
  'copy-check': '0 0 16 16',
};

const DEFAULT_STROKE_WIDTH: Record<IconName, number> = {
  close: 1.5,
  'chevron-down': 2,
  'chevron-right': 1.5,
  'alert-circle': 1.5,
  'check-circle': 1.5,
  bell: 2,
  copy: 1.5,
  'copy-check': 2,
};

const CONTENT: Record<IconName, (strokeWidth: number) => ReactNode> = {
  close: (sw) => (
    <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
  ),
  'chevron-down': (sw) => (
    <polyline
      points="6 9 12 15 18 9"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'chevron-right': (sw) => (
    <path
      d="M6 3L11 8L6 13"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'alert-circle': (sw) => (
    <>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth={sw} />
      <path d="M8 4.5V8.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.75" fill="currentColor" />
    </>
  ),
  'check-circle': (sw) => (
    <>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth={sw} />
      <path
        d="M5 8L7 10L11 6"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  bell: (sw) => (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth={sw} />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth={sw} />
    </>
  ),
  copy: (sw) => (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" stroke="currentColor" strokeWidth={sw} rx="1" />
      <path
        d="M3.5 10.5H2.5C1.94772 10.5 1.5 10.0523 1.5 9.5V2.5C1.5 1.94772 1.94772 1.5 2.5 1.5H9.5C10.0523 1.5 10.5 1.94772 10.5 2.5V3.5"
        stroke="currentColor"
        strokeWidth={sw}
      />
    </>
  ),
  'copy-check': (sw) => (
    <path
      d="M13.5 4.5L6 12L2.5 8.5"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export function Icon({ name, size = 16, strokeWidth, className }: IconProps) {
  const sw = strokeWidth ?? DEFAULT_STROKE_WIDTH[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={VIEW_BOX[name]}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {CONTENT[name](sw)}
    </svg>
  );
}
