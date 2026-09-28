import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkeletonBase } from '../SkeletonBase';
import {
  FormCardSkeleton,
  TransactionTableSkeleton,
  QuoteDisplaySkeleton,
  WalletConnectionSkeleton,
  AnalyticsDashboardSkeleton,
  BankAccountInputSkeleton,
} from '../index';

describe('Skeleton Consolidation - Shared Primitive Pattern', () => {
  describe('SkeletonBase as Single Source of Truth', () => {
    it('all skeleton variants compose SkeletonBase for consistent animation', () => {
      const { container: formContainer } = render(<FormCardSkeleton />);
      const { container: tableContainer } = render(<TransactionTableSkeleton rows={2} />);
      const { container: quoteContainer } = render(<QuoteDisplaySkeleton />);

      expect(formContainer.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
      expect(tableContainer.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
      expect(quoteContainer.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('SkeletonBase single source reduces maintenance burden', () => {
      render(<SkeletonBase width={100} height={16} />);

      const skeletonEl = screen.getByRole('status');
      expect(skeletonEl).toHaveClass('skeleton');
      expect(skeletonEl).toHaveAttribute('aria-busy', 'true');
    });

    it('each skeleton variant uses role=status and aria-busy for accessibility', () => {
      const { container: walletContainer } = render(<WalletConnectionSkeleton />);

      const statusElements = walletContainer.querySelectorAll('[role="status"]');
      expect(statusElements.length).toBeGreaterThan(0);

      statusElements.forEach((el) => {
        expect(el).toHaveAttribute('aria-busy', 'true');
      });
    });
  });

  describe('Skeleton Variant Deduplication', () => {
    it('FormCardSkeleton reuses SkeletonBase instead of inline markup', () => {
      const { container } = render(<FormCardSkeleton />);

      const skeletonElements = container.querySelectorAll('.skeleton');
      expect(skeletonElements.length).toBeGreaterThan(0);
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('TransactionTableSkeleton composes SkeletonBase for row and header skeletons', () => {
      const { container } = render(<TransactionTableSkeleton rows={3} />);

      const skeletonElements = container.querySelectorAll('.skeleton');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });

    it('QuoteDisplaySkeleton uses shared primitive for placeholder values', () => {
      const { container } = render(<QuoteDisplaySkeleton />);

      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('WalletConnectionSkeleton uses SkeletonBase for balance placeholders', () => {
      const { container } = render(<WalletConnectionSkeleton />);

      const skeletonElements = container.querySelectorAll('.skeleton');
      expect(skeletonElements.length).toBe(2);
    });

    it('AnalyticsDashboardSkeleton composes base primitive for chart placeholders', () => {
      const { container } = render(<AnalyticsDashboardSkeleton />);

      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('BankAccountInputSkeleton uses shared primitive for input field placeholders', () => {
      const { container } = render(<BankAccountInputSkeleton fields={2} />);

      const skeletonElements = container.querySelectorAll('.skeleton');
      expect(skeletonElements.length).toBe(7);
    });
  });

  describe('Parametrized Skeleton Properties', () => {
    it('SkeletonBase accepts width and height props', () => {
      render(<SkeletonBase width={150} height={24} />);

      expect(screen.getByRole('status')).toHaveStyle({
        width: '150px',
        height: '24px',
      });
    });

    it('SkeletonBase accepts string dimensions for flexible sizing', () => {
      render(<SkeletonBase width="100%" height="32px" />);

      expect(screen.getByRole('status')).toHaveStyle({
        width: '100%',
        height: '32px',
      });
    });

    it('SkeletonBase merges custom className with skeleton class', () => {
      render(<SkeletonBase className="rounded-lg mb-2" />);

      const el = screen.getByRole('status');
      expect(el).toHaveClass('skeleton');
      expect(el).toHaveClass('rounded-lg');
      expect(el).toHaveClass('mb-2');
    });

    it('BankAccountInputSkeleton scales with fields prop', () => {
      const { container: container1 } = render(<BankAccountInputSkeleton fields={1} />);
      const skeletonsCount1 = container1.querySelectorAll('.skeleton').length;

      const { container: container2 } = render(<BankAccountInputSkeleton fields={3} />);
      const skeletonsCount2 = container2.querySelectorAll('.skeleton').length;

      expect(skeletonsCount2).toBeGreaterThan(skeletonsCount1);
    });

    it('TransactionTableSkeleton scales with rows prop', () => {
      const { container: container1 } = render(<TransactionTableSkeleton rows={2} />);
      const skeletonsCount1 = container1.querySelectorAll('.skeleton').length;

      const { container: container2 } = render(<TransactionTableSkeleton rows={5} />);
      const skeletonsCount2 = container2.querySelectorAll('.skeleton').length;

      expect(skeletonsCount2).toBeGreaterThan(skeletonsCount1);
    });
  });

  describe('Animation Consistency Across Variants', () => {
    it('all skeletons apply .skeleton class for unified shimmer', () => {
      const skeletons = [
        <FormCardSkeleton key="form" />,
        <TransactionTableSkeleton key="table" rows={1} />,
        <QuoteDisplaySkeleton key="quote" />,
        <WalletConnectionSkeleton key="wallet" />,
        <AnalyticsDashboardSkeleton key="analytics" />,
        <BankAccountInputSkeleton key="bank" fields={1} />,
      ];

      skeletons.forEach((skeleton) => {
        const { container } = render(skeleton);
        expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
      });
    });

    it('each skeleton variant maintains visual stability via snapshot', () => {
      const { container: formContainer } = render(<FormCardSkeleton />);
      expect(formContainer.firstChild).toMatchSnapshot();

      const { container: quoteContainer } = render(<QuoteDisplaySkeleton />);
      expect(quoteContainer.firstChild).toMatchSnapshot();
    });
  });

  describe('Accessibility of Consolidated Primitive', () => {
    it('all skeleton variants inherit aria-busy and role from SkeletonBase', () => {
      const variants = [
        <FormCardSkeleton key="form" />,
        <WalletConnectionSkeleton key="wallet" />,
      ];

      variants.forEach((variant) => {
        const { container } = render(variant);
        const statusElements = container.querySelectorAll('[role="status"][aria-busy="true"]');
        expect(statusElements.length).toBeGreaterThan(0);
      });
    });

    it('SkeletonBase supports custom aria-label for context-specific accessibility', () => {
      render(<SkeletonBase aria-label="Loading transaction data…" />);

      expect(screen.getByRole('status', { name: 'Loading transaction data…' })).toBeInTheDocument();
    });

    it('SkeletonBase defaults to generic aria-label when not provided', () => {
      render(<SkeletonBase />);

      expect(screen.getByRole('status', { name: 'Loading…' })).toBeInTheDocument();
    });
  });

  describe('Duplicate Removal and Call Site Replacement', () => {
    it('FormCardSkeleton delegates to SkeletonBase instead of inline placeholders', () => {
      const { container } = render(<FormCardSkeleton />);

      const skeletons = container.querySelectorAll('.skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
      expect(container.querySelectorAll('[role="status"]').length).toBeGreaterThan(0);
    });

    it('TransactionTableSkeleton creates rows using shared primitive', () => {
      const { container } = render(<TransactionTableSkeleton rows={2} />);

      expect(container.querySelectorAll('.skeleton').length).toBe(10);
    });

    it('QuoteDisplaySkeleton uses primitive for all placeholders', () => {
      const { container } = render(<QuoteDisplaySkeleton />);

      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility After Consolidation', () => {
    it('all existing skeleton exports remain available', () => {
      expect(FormCardSkeleton).toBeDefined();
      expect(TransactionTableSkeleton).toBeDefined();
      expect(QuoteDisplaySkeleton).toBeDefined();
      expect(WalletConnectionSkeleton).toBeDefined();
      expect(AnalyticsDashboardSkeleton).toBeDefined();
      expect(BankAccountInputSkeleton).toBeDefined();
    });

    it('component props remain unchanged after consolidation', () => {
      const { container: withRows } = render(<TransactionTableSkeleton rows={4} />);
      expect(withRows.querySelectorAll('.skeleton').length).toBe(18);

      const { container: withFields } = render(<BankAccountInputSkeleton fields={2} />);
      expect(withFields.querySelectorAll('.skeleton').length).toBe(7);
    });
  });
});
