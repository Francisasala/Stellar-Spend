import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentList } from '../ComponentList';
import { CorridorList } from '../CorridorList';
import { UptimeSection } from '../UptimeSection';
import { getStatusColor, getStatusText, formatTime } from '../types';

describe('StatusPage Subcomponents', () => {
  describe('ComponentList', () => {
    it('renders list of system components', () => {
      const components = [
        { name: 'API Server', status: 'operational' as const, lastCheck: Date.now(), responseTime: 25 },
      ];
      render(<ComponentList components={components} />);

      expect(screen.getByText('API Server')).toBeInTheDocument();
      expect(screen.getByText('25ms')).toBeInTheDocument();
      expect(screen.getByText('Operational')).toBeInTheDocument();
    });
  });

  describe('CorridorList', () => {
    it('renders payment corridors and providers', () => {
      const corridors = [
        { corridor: 'USDC → NGN', provider: 'Paycrest', status: 'operational' as const, lastTransaction: Date.now() - 60000 },
      ];
      render(<CorridorList corridors={corridors} />);

      expect(screen.getByText('USDC → NGN')).toBeInTheDocument();
      expect(screen.getByText('Paycrest')).toBeInTheDocument();
    });
  });

  describe('UptimeSection', () => {
    it('renders uptime percentages', () => {
      render(<UptimeSection uptime={{ day: 99.99, week: 99.95, month: 99.9 }} />);
      expect(screen.getByText('99.99%')).toBeInTheDocument();
      expect(screen.getByText('24 hours')).toBeInTheDocument();
    });
  });

  describe('helpers', () => {
    it('computes status color and text', () => {
      expect(getStatusText('operational')).toBe('Operational');
      expect(getStatusColor('operational')).toContain('green');
      expect(getStatusText('down')).toBe('Down');
      expect(getStatusColor('down')).toContain('red');
    });

    it('formats elapsed time', () => {
      expect(formatTime(Date.now() - 30000)).toBe('30s ago');
      expect(formatTime(Date.now() - 180000)).toBe('3m ago');
    });
  });
});
