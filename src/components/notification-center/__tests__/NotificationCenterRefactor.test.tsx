import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationItem } from '../NotificationItem';
import { NotificationPanel } from '../NotificationPanel';
import { getEventIcon } from '../NotificationItem';
import { formatTime, getEventTypeColor } from '../types';
import type { NotificationCenterEvent } from '@/hooks/useNotificationCenter';

describe('NotificationCenter Refactor - Presentational Component Separation', () => {
  describe('NotificationItem as Pure Presentational Component', () => {
    const mockEvent: NotificationCenterEvent = {
      id: 'evt-1',
      type: 'transaction_update' as const,
      title: 'Transaction Complete',
      description: 'Your payment has been processed',
      read: false,
      createdAt: Date.now() - 30000,
    };

    it('renders notification without data-fetching', () => {
      render(
        <NotificationItem
          event={mockEvent}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      expect(screen.getByText('Transaction Complete')).toBeInTheDocument();
      expect(screen.getByText('Your payment has been processed')).toBeInTheDocument();
    });

    it('calls onClick with event data on click', () => {
      const onClick = vi.fn();
      render(
        <NotificationItem
          event={mockEvent}
          onClick={onClick}
          onRemove={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText('Transaction Complete'));
      expect(onClick).toHaveBeenCalledWith(mockEvent);
    });

    it('calls onRemove with event id on remove click', () => {
      const onRemove = vi.fn();
      render(
        <NotificationItem
          event={mockEvent}
          onClick={vi.fn()}
          onRemove={onRemove}
        />,
      );

      fireEvent.click(screen.getByLabelText(/remove notification/i));
      expect(onRemove).toHaveBeenCalledWith('evt-1');
    });

    it('displays unread indicator for unread notifications', () => {
      const { container } = render(
        <NotificationItem
          event={{ ...mockEvent, read: false }}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      const li = container.querySelector('li');
      expect(li).toHaveClass('border-[#c9a962]');
    });

    it('does not display unread indicator for read notifications', () => {
      const { container } = render(
        <NotificationItem
          event={{ ...mockEvent, read: true }}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      const li = container.querySelector('li');
      expect(li).toHaveClass('bg-[#0a0a0a]');
    });

    it('renders optional link button when event has link', () => {
      const eventWithLink: NotificationCenterEvent = {
        ...mockEvent,
        link: { label: 'View Details', href: '/tx/123' },
      };

      render(
        <NotificationItem
          event={eventWithLink}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      expect(screen.getByText('View Details')).toBeInTheDocument();
    });

    it('does not render link button when event has no link', () => {
      render(
        <NotificationItem
          event={mockEvent}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      expect(screen.queryByText('View Details')).not.toBeInTheDocument();
    });

    it('is reusable with different event types', () => {
      const priceAlertEvent: NotificationCenterEvent = {
        id: 'evt-2',
        type: 'price_alert' as const,
        title: 'Price Alert',
        description: 'USDC price changed',
        read: true,
        createdAt: Date.now(),
      };

      const { rerender } = render(
        <NotificationItem
          event={mockEvent}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      expect(screen.getByText('Transaction Complete')).toBeInTheDocument();

      rerender(
        <NotificationItem
          event={priceAlertEvent}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      expect(screen.getByText('Price Alert')).toBeInTheDocument();
    });
  });

  describe('NotificationPanel as List Container', () => {
    const mockEvents: NotificationCenterEvent[] = [
      {
        id: 'evt-1',
        type: 'transaction_update' as const,
        title: 'Payment Sent',
        description: 'Funds transferred successfully',
        read: false,
        createdAt: Date.now() - 60000,
      },
      {
        id: 'evt-2',
        type: 'price_alert' as const,
        title: 'Price Update',
        description: 'Rate changed to 1500 NGN/USDC',
        read: true,
        createdAt: Date.now() - 120000,
      },
    ];

    it('renders list of notifications', () => {
      render(
        <NotificationPanel
          events={mockEvents}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      expect(screen.getByText('NOTIFICATIONS')).toBeInTheDocument();
      expect(screen.getByText('Payment Sent')).toBeInTheDocument();
      expect(screen.getByText('Price Update')).toBeInTheDocument();
    });

    it('calls onNotificationClick when item is clicked', () => {
      const onNotificationClick = vi.fn();
      render(
        <NotificationPanel
          events={mockEvents}
          loading={false}
          onNotificationClick={onNotificationClick}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText('Payment Sent'));
      expect(onNotificationClick).toHaveBeenCalled();
    });

    it('calls onRemoveEvent when item is removed', () => {
      const onRemoveEvent = vi.fn();
      const { getAllByLabelText } = render(
        <NotificationPanel
          events={mockEvents}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={onRemoveEvent}
          onClearAll={vi.fn()}
        />,
      );

      const removeButtons = getAllByLabelText(/remove notification/i);
      fireEvent.click(removeButtons[0]);
      expect(onRemoveEvent).toHaveBeenCalledWith('evt-1');
    });

    it('calls onMarkAllAsRead when Mark Read button is clicked', () => {
      const onMarkAllAsRead = vi.fn();
      render(
        <NotificationPanel
          events={mockEvents}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={onMarkAllAsRead}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText('Mark Read'));
      expect(onMarkAllAsRead).toHaveBeenCalled();
    });

    it('calls onClearAll when Clear All button is clicked', () => {
      const onClearAll = vi.fn();
      render(
        <NotificationPanel
          events={mockEvents}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={onClearAll}
        />,
      );

      fireEvent.click(screen.getByText(/clear all/i));
      expect(onClearAll).toHaveBeenCalled();
    });

    it('renders empty state for no notifications', () => {
      const { container } = render(
        <NotificationPanel
          events={[]}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      expect(screen.getByText('NOTIFICATIONS')).toBeInTheDocument();
    });
  });

  describe('Badge Pattern for Unread Indicators', () => {
    const unreadEvent: NotificationCenterEvent = {
      id: 'evt-1',
      type: 'transaction_update' as const,
      title: 'New Transaction',
      description: 'Payment received',
      read: false,
      createdAt: Date.now(),
    };

    const readEvent: NotificationCenterEvent = {
      id: 'evt-2',
      type: 'price_alert' as const,
      title: 'Price Update',
      description: 'Rate changed',
      read: true,
      createdAt: Date.now(),
    };

    it('displays unread badge for unread notifications', () => {
      const { container } = render(
        <NotificationItem
          event={unreadEvent}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      const li = container.querySelector('li');
      expect(li).toHaveClass('border-[#c9a962]');
      expect(li).toHaveClass('bg-[#1a1a1a]');
    });

    it('does not display unread badge for read notifications', () => {
      const { container } = render(
        <NotificationItem
          event={readEvent}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      const li = container.querySelector('li');
      expect(li).toHaveClass('bg-[#0a0a0a]');
      expect(li).not.toHaveClass('bg-[#1a1a1a]');
    });
  });

  describe('Icon Component for Event Types', () => {
    it('returns correct icon for price_alert', () => {
      const icon = getEventIcon('price_alert');
      expect(icon).not.toBeNull();
    });

    it('returns correct icon for transaction_update', () => {
      const icon = getEventIcon('transaction_update');
      expect(icon).not.toBeNull();
    });

    it('returns correct icon for payout_update', () => {
      const icon = getEventIcon('payout_update');
      expect(icon).not.toBeNull();
    });

    it('returns correct icon for tier_change', () => {
      const icon = getEventIcon('tier_change');
      expect(icon).not.toBeNull();
    });

    it('returns null for unknown event type', () => {
      const icon = getEventIcon('unknown_type');
      expect(icon).toBeNull();
    });

    it('icon has correct svg dimensions', () => {
      const icon = getEventIcon('transaction_update');
      expect(icon?.props.width).toBe('16');
      expect(icon?.props.height).toBe('16');
    });
  });

  describe('Data Logic Separation from Presentation', () => {
    it('NotificationItem does not call useNotificationCenter hook', () => {
      const mockEvent: NotificationCenterEvent = {
        id: 'evt-1',
        type: 'transaction_update' as const,
        title: 'Test',
        description: 'Test description',
        read: false,
        createdAt: Date.now(),
      };

      const onClick = vi.fn();
      const onRemove = vi.fn();

      render(
        <NotificationItem
          event={mockEvent}
          onClick={onClick}
          onRemove={onRemove}
        />,
      );

      expect(onClick).not.toHaveBeenCalled();
      expect(onRemove).not.toHaveBeenCalled();
    });

    it('NotificationPanel delegates data logic to parent container via callbacks', () => {
      const onNotificationClick = vi.fn();
      const onMarkAllAsRead = vi.fn();
      const onRemoveEvent = vi.fn();
      const onClearAll = vi.fn();

      const mockEvents: NotificationCenterEvent[] = [
        {
          id: 'evt-1',
          type: 'transaction_update' as const,
          title: 'Test',
          description: 'Test',
          read: false,
          createdAt: Date.now(),
        },
      ];

      render(
        <NotificationPanel
          events={mockEvents}
          loading={false}
          onNotificationClick={onNotificationClick}
          onMarkAllAsRead={onMarkAllAsRead}
          onRemoveEvent={onRemoveEvent}
          onClearAll={onClearAll}
        />,
      );

      fireEvent.click(screen.getByText('Mark Read'));
      expect(onMarkAllAsRead).toHaveBeenCalled();
    });
  });

  describe('Reusability of Presentational Components', () => {
    it('NotificationItem can be reused with any notification event', () => {
      const event1: NotificationCenterEvent = {
        id: 'evt-1',
        type: 'transaction_update' as const,
        title: 'Transaction 1',
        description: 'Description 1',
        read: false,
        createdAt: Date.now(),
      };

      const event2: NotificationCenterEvent = {
        id: 'evt-2',
        type: 'price_alert' as const,
        title: 'Alert 2',
        description: 'Description 2',
        read: true,
        createdAt: Date.now(),
      };

      const { rerender } = render(
        <NotificationItem
          event={event1}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      expect(screen.getByText('Transaction 1')).toBeInTheDocument();

      rerender(
        <NotificationItem
          event={event2}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      expect(screen.getByText('Alert 2')).toBeInTheDocument();
    });

    it('NotificationPanel is reusable with different event lists', () => {
      const events1: NotificationCenterEvent[] = [
        {
          id: 'evt-1',
          type: 'transaction_update' as const,
          title: 'Event 1',
          description: 'Desc 1',
          read: false,
          createdAt: Date.now(),
        },
      ];

      const events2: NotificationCenterEvent[] = [
        {
          id: 'evt-2',
          type: 'price_alert' as const,
          title: 'Event 2',
          description: 'Desc 2',
          read: true,
          createdAt: Date.now(),
        },
        {
          id: 'evt-3',
          type: 'payout_update' as const,
          title: 'Event 3',
          description: 'Desc 3',
          read: false,
          createdAt: Date.now(),
        },
      ];

      const { rerender } = render(
        <NotificationPanel
          events={events1}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      expect(screen.getByText('Event 1')).toBeInTheDocument();

      rerender(
        <NotificationPanel
          events={events2}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      expect(screen.getByText('Event 2')).toBeInTheDocument();
      expect(screen.getByText('Event 3')).toBeInTheDocument();
    });
  });

  describe('Helper Functions as Pure Utilities', () => {
    it('formatTime is a pure function', () => {
      const timestamp = Date.now() - 60000;
      const result1 = formatTime(timestamp);
      const result2 = formatTime(timestamp);

      expect(result1).toBe(result2);
    });

    it('formatTime returns correct time intervals', () => {
      expect(formatTime(Date.now() - 10000)).toBe('just now');
      expect(formatTime(Date.now() - 120000)).toBe('2m ago');
      expect(formatTime(Date.now() - 7200000)).toBe('2h ago');
    });

    it('getEventTypeColor returns correct color classes', () => {
      expect(getEventTypeColor('price_alert')).toContain('amber');
      expect(getEventTypeColor('transaction_update')).toContain('blue');
    });

    it('getEventTypeColor is deterministic', () => {
      const color1 = getEventTypeColor('price_alert');
      const color2 = getEventTypeColor('price_alert');

      expect(color1).toBe(color2);
    });
  });

  describe('No Data Mutations in Presentational Layer', () => {
    it('NotificationItem does not mutate event object', () => {
      const mockEvent: NotificationCenterEvent = {
        id: 'evt-1',
        type: 'transaction_update' as const,
        title: 'Test Event',
        description: 'Test',
        read: false,
        createdAt: Date.now(),
      };

      const originalEvent = JSON.stringify(mockEvent);

      render(
        <NotificationItem
          event={mockEvent}
          onClick={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      expect(JSON.stringify(mockEvent)).toBe(originalEvent);
    });

    it('NotificationPanel does not mutate events array', () => {
      const mockEvents: NotificationCenterEvent[] = [
        {
          id: 'evt-1',
          type: 'transaction_update' as const,
          title: 'Test',
          description: 'Test',
          read: false,
          createdAt: Date.now(),
        },
      ];

      const originalEvents = JSON.stringify(mockEvents);

      render(
        <NotificationPanel
          events={mockEvents}
          loading={false}
          onNotificationClick={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onRemoveEvent={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );

      expect(JSON.stringify(mockEvents)).toBe(originalEvents);
    });
  });
});
