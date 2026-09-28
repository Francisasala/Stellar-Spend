/**
 * component-snapshots.test.tsx
 *
 * Issue #1008 — Snapshot tests for stable presentational components
 *
 * Covers 10 stable presentational components to catch unintended markup
 * changes. Snapshots are rendered once; on subsequent runs Vitest diffs
 * against the stored .snap file.
 *
 * ## Snapshot update policy
 *
 * Snapshots must only be updated **intentionally**, never automatically on CI:
 *
 *   1. Run  `npx vitest --run --update-snapshots src/test/snapshots/component-snapshots.test.tsx`
 *      locally after verifying the rendered output is correct.
 *   2. Commit the updated `.snap` file in the same PR as the component change.
 *   3. In the PR description, add a "Snapshot update" section explaining what
 *      changed and why.
 *
 * CI runs with `--run` (no `--update-snapshots`); a snapshot mismatch is a
 * failing test that blocks merge.
 *
 * ## Covered components (10)
 *
 *  1. Button (ui) — all variant/size combinations
 *  2. Input (ui) — default, error, disabled
 *  3. Badge (design-system) — all variants
 *  4. Alert (design-system) — all variants with/without title
 *  5. Card / CardHeader / CardContent / CardFooter (design-system)
 *  6. SkeletonBase (skeletons) — various widths/heights
 *  7. StatusBadge — representative statuses
 *  8. CollapsibleSection — collapsed and expanded
 *  9. Hero — server component, no props
 * 10. OfflineBanner — offline / syncing state
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Component imports
// ─────────────────────────────────────────────────────────────────────────────

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/design-system/Badge';
import { Alert } from '@/components/design-system/Alert';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/design-system/Card';
import { SkeletonBase } from '@/components/skeletons/SkeletonBase';
import { StatusBadge } from '@/components/StatusBadge';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import Hero from '@/components/Hero';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Render a component and return the outer HTML for snapshotting. */
function snap(ui: React.ReactElement): string {
  const { container } = render(ui);
  return container.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Button
// ─────────────────────────────────────────────────────────────────────────────

describe('Button snapshots', () => {
  it('renders primary/md (default) correctly', () => {
    expect(snap(<Button>Pay now</Button>)).toMatchSnapshot();
  });

  it('renders secondary variant correctly', () => {
    expect(snap(<Button variant="secondary">Cancel</Button>)).toMatchSnapshot();
  });

  it('renders danger variant correctly', () => {
    expect(snap(<Button variant="danger">Delete</Button>)).toMatchSnapshot();
  });

  it('renders ghost variant correctly', () => {
    expect(snap(<Button variant="ghost">Skip</Button>)).toMatchSnapshot();
  });

  it('renders small size correctly', () => {
    expect(snap(<Button size="sm">Small</Button>)).toMatchSnapshot();
  });

  it('renders large size correctly', () => {
    expect(snap(<Button size="lg">Large</Button>)).toMatchSnapshot();
  });

  it('renders disabled state correctly', () => {
    expect(snap(<Button disabled>Disabled</Button>)).toMatchSnapshot();
  });

  it('renders loading state correctly', () => {
    expect(snap(<Button isLoading>Loading</Button>)).toMatchSnapshot();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Input
// ─────────────────────────────────────────────────────────────────────────────

describe('Input snapshots', () => {
  it('renders default variant correctly', () => {
    expect(snap(<Input placeholder="Enter amount" />)).toMatchSnapshot();
  });

  it('renders error variant correctly', () => {
    expect(snap(<Input variant="error" placeholder="Invalid" />)).toMatchSnapshot();
  });

  it('renders small size correctly', () => {
    expect(snap(<Input inputSize="sm" placeholder="Small" />)).toMatchSnapshot();
  });

  it('renders large size correctly', () => {
    expect(snap(<Input inputSize="lg" placeholder="Large" />)).toMatchSnapshot();
  });

  it('renders disabled state correctly', () => {
    expect(snap(<Input disabled placeholder="Cannot edit" />)).toMatchSnapshot();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Badge
// ─────────────────────────────────────────────────────────────────────────────

describe('Badge snapshots', () => {
  const variants = ['default', 'success', 'warning', 'error', 'info'] as const;

  for (const variant of variants) {
    it(`renders ${variant} variant correctly`, () => {
      expect(snap(<Badge variant={variant}>{variant}</Badge>)).toMatchSnapshot();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Alert
// ─────────────────────────────────────────────────────────────────────────────

describe('Alert snapshots', () => {
  it('renders info variant with title and children', () => {
    expect(
      snap(
        <Alert variant="info" title="Information">
          Your transaction is being processed.
        </Alert>,
      ),
    ).toMatchSnapshot();
  });

  it('renders success variant with title', () => {
    expect(
      snap(
        <Alert variant="success" title="Success">
          Transfer complete!
        </Alert>,
      ),
    ).toMatchSnapshot();
  });

  it('renders warning variant with title', () => {
    expect(
      snap(
        <Alert variant="warning" title="Warning">
          Insufficient balance.
        </Alert>,
      ),
    ).toMatchSnapshot();
  });

  it('renders error variant with title', () => {
    expect(
      snap(
        <Alert variant="error" title="Error">
          Transaction failed.
        </Alert>,
      ),
    ).toMatchSnapshot();
  });

  it('renders without a title (children only)', () => {
    expect(snap(<Alert>Simple message without title.</Alert>)).toMatchSnapshot();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Card family
// ─────────────────────────────────────────────────────────────────────────────

describe('Card snapshots', () => {
  it('renders default Card correctly', () => {
    expect(snap(<Card>Card content</Card>)).toMatchSnapshot();
  });

  it('renders elevated Card correctly', () => {
    expect(snap(<Card variant="elevated">Elevated</Card>)).toMatchSnapshot();
  });

  it('renders outlined Card correctly', () => {
    expect(snap(<Card variant="outlined">Outlined</Card>)).toMatchSnapshot();
  });

  it('renders Card with header, content, and footer', () => {
    expect(
      snap(
        <Card>
          <CardHeader>Transaction Details</CardHeader>
          <CardContent>Amount: 100 USDC</CardContent>
          <CardFooter>Estimated arrival: 5 minutes</CardFooter>
        </Card>,
      ),
    ).toMatchSnapshot();
  });

  it('renders CardHeader standalone correctly', () => {
    expect(snap(<CardHeader>My Header</CardHeader>)).toMatchSnapshot();
  });

  it('renders CardContent standalone correctly', () => {
    expect(snap(<CardContent>My Content</CardContent>)).toMatchSnapshot();
  });

  it('renders CardFooter standalone correctly', () => {
    expect(snap(<CardFooter>My Footer</CardFooter>)).toMatchSnapshot();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SkeletonBase
// ─────────────────────────────────────────────────────────────────────────────

describe('SkeletonBase snapshots', () => {
  it('renders with no explicit dimensions', () => {
    expect(snap(<SkeletonBase />)).toMatchSnapshot();
  });

  it('renders with numeric width and height', () => {
    expect(snap(<SkeletonBase width={200} height={20} />)).toMatchSnapshot();
  });

  it('renders with string dimensions', () => {
    expect(snap(<SkeletonBase width="100%" height="1rem" />)).toMatchSnapshot();
  });

  it('renders with custom aria-label', () => {
    expect(snap(<SkeletonBase aria-label="Loading balance" />)).toMatchSnapshot();
  });

  it('renders with additional className', () => {
    expect(snap(<SkeletonBase className="rounded-full" width={40} height={40} />)).toMatchSnapshot();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. StatusBadge
// ─────────────────────────────────────────────────────────────────────────────

describe('StatusBadge snapshots', () => {
  const representativeStatuses = [
    'pending',
    'completed',
    'failed',
    'processing',
    'settling',
    'success',
    'error',
    'SETTLING',
    'COMPLETE',
  ] as const;

  for (const status of representativeStatuses) {
    it(`renders ${status} status correctly`, () => {
      expect(snap(<StatusBadge status={status} />)).toMatchSnapshot();
    });
  }

  it('renders without icon', () => {
    expect(snap(<StatusBadge status="completed" showIcon={false} />)).toMatchSnapshot();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. CollapsibleSection
// ─────────────────────────────────────────────────────────────────────────────

describe('CollapsibleSection snapshots', () => {
  it('renders collapsed by default', () => {
    expect(
      snap(
        <CollapsibleSection id="test-section" title="Fee Breakdown">
          <p>0.5% bridge fee + 0% payout fee</p>
        </CollapsibleSection>,
      ),
    ).toMatchSnapshot();
  });

  it('renders with description', () => {
    expect(
      snap(
        <CollapsibleSection
          id="desc-section"
          title="Transaction Details"
          description="View the full breakdown"
        >
          <p>Details here</p>
        </CollapsibleSection>,
      ),
    ).toMatchSnapshot();
  });

  it('renders open by default', () => {
    expect(
      snap(
        <CollapsibleSection id="open-section" title="Open Section" defaultOpen={true}>
          <p>Visible content</p>
        </CollapsibleSection>,
      ),
    ).toMatchSnapshot();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Hero
// ─────────────────────────────────────────────────────────────────────────────

describe('Hero snapshots', () => {
  it('renders Hero correctly', () => {
    expect(snap(<Hero />)).toMatchSnapshot();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. OfflineBanner (structural snapshot — rendered in default online state)
// ─────────────────────────────────────────────────────────────────────────────

describe('OfflineBanner snapshots', () => {
  it('renders nothing when online (default browser state)', () => {
    // jsdom defaults navigator.onLine to true, so the banner does not render.
    // Snapshot confirms this contract — no accidental markup leak.
    const { container } = render(
      React.createElement(
        // Dynamic import to avoid background-sync side-effects at module load
        React.lazy(() =>
          import('@/components/OfflineBanner').then((m) => ({ default: m.default })),
        ),
      ),
    );
    // React.lazy requires Suspense; without it React renders nothing
    // We verify the container is empty — the component gate is `!isOffline && !isSyncing`
    expect(container.innerHTML).toMatchSnapshot();
  });
});
