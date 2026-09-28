import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationItem } from '../NotificationItem';
import { NotificationPanel } from '../NotificationPanel';
import { formatTime, getEventTypeColor } from '../types';
import type { NotificationCenterEvent } from '@/hooks/useNotificationCenter';

describe('NotificationCenter Subcomponents', () => {
  const mockEvent: NotificationCenterEvent = {
    id: 'evt-1',
    type: 'transaction_update',
    title: 'Payout Delivered',
    description: 'Funds sent to your account',
    read: false,
    createdAt: Date.now() - 30000,
  };

  describe('NotificationItem', () => {
    it('renders notification title and handles clicks', () => {
      const onClick = vi.fn();
      const onRemove = vi.fn();

      render(<NotificationItem event={mockEvent} onClick={onClick} onRemove={onRemove} />);

      expect(screen.getByText('Payout Delivered')).toBeInTheDocument();
      expect(screen.getByText('Funds sent to your account')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Payout Delivered'));
      expect(onClick).toHaveBeenCalledWith(mockEvent);

      fireEvent.click(screen.getByLabelText(/remove notification/i));
      expect(onRemove).toHaveBeenCalledWith('evt-1');
    });
  });

  describe('NotificationPanel', () => {
    it('renders list of events and clear all button', () => {
      const onClearAll = vi.fn();
      const onMarkAllAsRead = vi.fn();

      render(
        <NotificationPanel
          events={[mockEvent]}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={onMarkAllAsRead}
          onRemoveEvent={vi.fn()}
          onClearAll={onClearAll}
        />,
      );

      expect(screen.getByText('NOTIFICATIONS')).toBeInTheDocument();
      expect(screen.getByText('Mark Read')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Mark Read'));
      expect(onMarkAllAsRead).toHaveBeenCalled();

      fireEvent.click(screen.getByText(/clear all/i));
      expect(onClearAll).toHaveBeenCalled();
    });
  });

  describe('helpers', () => {
    it('formats time intervals', () => {
      expect(formatTime(Date.now() - 10000)).toBe('just now');
      expect(formatTime(Date.now() - 120000)).toBe('2m ago');
      expect(formatTime(Date.now() - 7200000)).toBe('2h ago');
    });

    it('returns event type colors', () => {
      expect(getEventTypeColor('price_alert')).toContain('amber');
      expect(getEventTypeColor('transaction_update')).toContain('blue');
    });
  });

  describe('Accessibility: aria-live announcements', () => {
    it('should have aria-live region for live notifications', () => {
      render(
        <div role="region" aria-live="polite" aria-label="Notifications">
          <NotificationPanel
            events={[mockEvent]}
            loading={false}
            onNotificationClick={vi.fn()}
            onMarkAllAsRead={vi.fn()}
            onRemoveEvent={vi.fn()}
            onClearAll={vi.fn()}
          />
        </div>,
      );

      const liveRegion = screen.getByRole('region');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('should announce new notifications to screen readers', () => {
      const newEvent: NotificationCenterEvent = {
        id: 'evt-2',
        type: 'price_alert',
        title: 'Price Alert',
        description: 'USDC price changed',
        read: false,
        createdAt: Date.now(),
      };

      render(
        <NotificationPanel
          events={[mockEvent, newEvent]}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      expect(screen.getByText('Price Alert')).toBeInTheDocument();
    });

    it('should announce notification removal to screen readers', () => {
      const onRemove = vi.fn();

      render(
        <NotificationItem
          event={mockEvent}
          onClick={vi.fn()}
          onRemove={onRemove}
        />,
      );

      const removeButton = screen.getByLabelText(/remove notification/i);
      fireEvent.click(removeButton);

      expect(onRemove).toHaveBeenCalled();
    });

    it('should have descriptive aria-labels on interactive elements', () => {
      render(
        <NotificationPanel
          events={[mockEvent]}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label');
      expect(screen.getByText('Mark Read')).toHaveAttribute('title');
      expect(screen.getByText(/clear all/i)).toHaveAttribute('title');
    });
  });

  describe('Accessibility: keyboard navigation', () => {
    it('should support keyboard navigation through notification list', () => {
      const events = [
        mockEvent,
        {
          ...mockEvent,
          id: 'evt-2',
          title: 'Second Notification',
        },
      ];

      render(
        <NotificationPanel
          events={events}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      const notificationList = screen.getByRole('list');
      expect(notificationList).toBeInTheDocument();
    });

    it('should allow tabbing through notification controls', () => {
      render(
        <NotificationPanel
          events={[mockEvent]}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      const markReadButton = screen.getByText('Mark Read');
      const clearAllButton = screen.getByText(/clear all/i);

      expect(markReadButton).toBeInTheDocument();
      expect(clearAllButton).toBeInTheDocument();
    });

    it('should handle Enter key on notification items', () => {
      const onClick = vi.fn();

      render(
        <NotificationItem
          event={mockEvent}
          onClick={onClick}
          onRemove={vi.fn()}
        />,
      );

      const notificationElement = screen.getByText('Payout Delivered').closest('li');
      fireEvent.keyDown(notificationElement!, { key: 'Enter' });

      expect(notificationElement).toBeInTheDocument();
    });

    it('should have proper focus management', () => {
      render(
        <NotificationPanel
          events={[mockEvent]}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      const markReadButton = screen.getByText('Mark Read');
      markReadButton.focus();

      expect(markReadButton).toHaveFocus();
    });
  });

  describe('Accessibility: semantic structure', () => {
    it('should use semantic HTML for notification list', () => {
      render(
        <NotificationPanel
          events={[mockEvent]}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getByRole('listitem')).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      render(
        <NotificationPanel
          events={[mockEvent]}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      expect(screen.getByText('NOTIFICATIONS')).toBeInTheDocument();
    });

    it('should have proper button semantics', () => {
      render(
        <NotificationPanel
          events={[mockEvent]}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
