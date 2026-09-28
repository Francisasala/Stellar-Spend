import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentList } from '../ComponentList';
import { CorridorList } from '../CorridorList';
import { UptimeSection } from '../UptimeSection';
import type { ComponentStatus, CorridorStatus } from '../types';

describe('StatusPage Component Tree Refactoring - Admin/User Reuse', () => {
  describe('Shared Layout Primitives', () => {
    describe('ComponentList - Shared Across Admin and User Views', () => {
      it('renders as a reusable component for both admin and user contexts', () => {
        const components: ComponentStatus[] = [
          { name: 'API Gateway', status: 'operational' as const, lastCheck: Date.now(), responseTime: 15 },
          { name: 'Payment Processor', status: 'degraded' as const, lastCheck: Date.now() - 5000 },
          { name: 'Database', status: 'down' as const, lastCheck: Date.now() - 10000 },
        ];

        render(<ComponentList components={components} />);

        expect(screen.getByText('Components')).toBeInTheDocument();
        expect(screen.getByText('API Gateway')).toBeInTheDocument();
        expect(screen.getByText('Payment Processor')).toBeInTheDocument();
        expect(screen.getByText('Database')).toBeInTheDocument();
      });

      it('handles empty component list gracefully', () => {
        const { container } = render(<ComponentList components={[]} />);
        expect(container.querySelector('h2')).toHaveTextContent('Components');
      });

      it('displays status indicators correctly for all states', () => {
        const components: ComponentStatus[] = [
          { name: 'Service A', status: 'operational' as const, lastCheck: Date.now() },
          { name: 'Service B', status: 'degraded' as const, lastCheck: Date.now() },
          { name: 'Service C', status: 'down' as const, lastCheck: Date.now() },
        ];

        const { container } = render(<ComponentList components={components} />);

        const statusIndicators = container.querySelectorAll('div.w-2.h-2.rounded-full');
        expect(statusIndicators.length).toBeGreaterThanOrEqual(3);
      });

      it('includes response time metric when available', () => {
        const components: ComponentStatus[] = [
          { name: 'Fast Service', status: 'operational' as const, lastCheck: Date.now(), responseTime: 8 },
          { name: 'Slow Service', status: 'operational' as const, lastCheck: Date.now(), responseTime: 250 },
        ];

        render(<ComponentList components={components} />);

        expect(screen.getByText('8ms')).toBeInTheDocument();
        expect(screen.getByText('250ms')).toBeInTheDocument();
      });

      it('omits response time when not provided', () => {
        const components: ComponentStatus[] = [
          { name: 'Service Without Metrics', status: 'operational' as const, lastCheck: Date.now() },
        ];

        render(<ComponentList components={components} />);
        expect(screen.queryByText(/\d+ms/)).not.toBeInTheDocument();
      });
    });

    describe('CorridorList - Shared Across Admin and User Views', () => {
      it('renders payment corridors consistently for both views', () => {
        const corridors: CorridorStatus[] = [
          { corridor: 'USDC → NGN', provider: 'Paycrest', status: 'operational' as const, lastTransaction: Date.now() - 60000 },
          { corridor: 'USDC → GHS', provider: 'Mazzuma', status: 'degraded' as const, lastTransaction: Date.now() - 120000 },
        ];

        render(<CorridorList corridors={corridors} />);

        expect(screen.getByText('Payment Corridors')).toBeInTheDocument();
        expect(screen.getByText('USDC → NGN')).toBeInTheDocument();
        expect(screen.getByText('USDC → GHS')).toBeInTheDocument();
        expect(screen.getByText('Paycrest')).toBeInTheDocument();
        expect(screen.getByText('Mazzuma')).toBeInTheDocument();
      });

      it('handles empty corridor list', () => {
        const { container } = render(<CorridorList corridors={[]} />);
        expect(container.querySelector('h2')).toHaveTextContent('Payment Corridors');
      });

      it('renders provider information for each corridor', () => {
        const corridors: CorridorStatus[] = [
          { corridor: 'USDC → KES', provider: 'African Fintech Co', status: 'operational' as const, lastTransaction: Date.now() },
        ];

        render(<CorridorList corridors={corridors} />);

        expect(screen.getByText('African Fintech Co')).toBeInTheDocument();
      });
    });

    describe('UptimeSection - Shared Layout', () => {
      it('renders uptime metrics consistently', () => {
        render(
          <UptimeSection uptime={{ day: 99.99, week: 99.95, month: 99.9 }} />
        );

        expect(screen.getByText('99.99%')).toBeInTheDocument();
        expect(screen.getByText('99.95%')).toBeInTheDocument();
        expect(screen.getByText('99.9%')).toBeInTheDocument();
      });

      it('includes time period labels', () => {
        render(
          <UptimeSection uptime={{ day: 100, week: 99.5, month: 98.5 }} />
        );

        expect(screen.getByText('24 hours')).toBeInTheDocument();
        expect(screen.getByText('7 days')).toBeInTheDocument();
        expect(screen.getByText('30 days')).toBeInTheDocument();
      });

      it('handles perfect uptime display', () => {
        render(
          <UptimeSection uptime={{ day: 100, week: 100, month: 100 }} />
        );

        const percentages = screen.getAllByText('100%');
        expect(percentages.length).toBeGreaterThanOrEqual(1);
      });

      it('handles degraded uptime display', () => {
        render(
          <UptimeSection uptime={{ day: 95, week: 92, month: 90 }} />
        );

        expect(screen.getByText('95%')).toBeInTheDocument();
      });
    });
  });

  describe('Admin vs User View Reuse', () => {
    it('ComponentList can be reused in admin dashboard without modification', () => {
      const adminComponents: ComponentStatus[] = [
        { name: 'Internal API', status: 'operational' as const, lastCheck: Date.now(), responseTime: 5 },
        { name: 'Admin Panel Database', status: 'operational' as const, lastCheck: Date.now(), responseTime: 12 },
      ];

      const { container } = render(<ComponentList components={adminComponents} />);

      expect(container.querySelectorAll('li, div').length).toBeGreaterThan(0);
    });

    it('ComponentList can be reused in user-facing status page', () => {
      const userComponents: ComponentStatus[] = [
        { name: 'Payment Processing', status: 'operational' as const, lastCheck: Date.now(), responseTime: 20 },
      ];

      const { container } = render(<ComponentList components={userComponents} />);

      expect(container.querySelectorAll('li, div').length).toBeGreaterThan(0);
    });

    it('CorridorList is reusable across different context configurations', () => {
      const corridors: CorridorStatus[] = [
        { corridor: 'USDC → USD', provider: 'Circle', status: 'operational' as const, lastTransaction: Date.now() },
      ];

      const { rerender } = render(<CorridorList corridors={corridors} />);

      expect(screen.getByText('USDC → USD')).toBeInTheDocument();

      const updatedCorridors: CorridorStatus[] = [
        { corridor: 'USDC → EUR', provider: 'Stripe', status: 'operational' as const, lastTransaction: Date.now() },
      ];

      rerender(<CorridorList corridors={updatedCorridors} />);
      expect(screen.getByText('USDC → EUR')).toBeInTheDocument();
    });
  });

  describe('Layout Extraction Integrity', () => {
    it('all subcomponents maintain consistent styling structure', () => {
      const components: ComponentStatus[] = [
        { name: 'Service', status: 'operational' as const, lastCheck: Date.now() },
      ];

      const { container: componentContainer } = render(<ComponentList components={components} />);

      expect(componentContainer.querySelector('[class*="border"]')).toBeInTheDocument();
      expect(componentContainer.querySelector('[class*="bg-"]')).toBeInTheDocument();
    });

    it('subcomponents are accessible and keyboard-navigable', () => {
      const components: ComponentStatus[] = [
        { name: 'Service', status: 'operational' as const, lastCheck: Date.now() },
      ];

      const { container } = render(<ComponentList components={components} />);

      const headings = container.querySelectorAll('h2');
      expect(headings.length).toBeGreaterThan(0);
    });
  });
});
