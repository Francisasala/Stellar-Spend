'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/Icon';
import type { NotificationCenterEvent } from '@/hooks/useNotificationCenter';
import type { NotificationCenterProps } from './notification-center/types';
import { NotificationPanel } from './notification-center/NotificationPanel';

export * from './notification-center/types';

export function NotificationCenter({
  events,
  unreadCount,
  unreadBadgeText,
  loading,
  onMarkAsRead,
  onMarkAllAsRead,
  onRemoveEvent,
  onClearAll,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  // Tracks newly arrived notification titles to announce via the aria-live region
  const [announcement, setAnnouncement] = useState<string>('');
  const prevEventIdsRef = useRef<Set<string>>(new Set());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Announce new notifications to screen readers via aria-live polite
  useEffect(() => {
    const newEvents = events.filter((e) => !prevEventIdsRef.current.has(e.id));
    if (newEvents.length > 0) {
      const titles = newEvents.map((e) => e.title).join(', ');
      if (newEvents.length === 1) {
        setAnnouncement(`New notification: ${titles}`);
      } else {
        setAnnouncement(`${newEvents.length} new notifications: ${titles}`);
      }
    }
    prevEventIdsRef.current = new Set(events.map((e) => e.id));
  }, [events]);

  // Clear announcement after a short delay so it can fire again on subsequent updates
  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 2000);
    return () => clearTimeout(t);
  }, [announcement]);

  // Reset focused index whenever the panel opens or the event list changes
  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  // Focus the correct notification button when focusedIndex changes
  useEffect(() => {
    if (!isOpen || focusedIndex < 0) return;
    const panel = panelRef.current;
    if (!panel) return;
    const buttons = panel.querySelectorAll<HTMLButtonElement>('li button:first-of-type');
    const target = buttons[focusedIndex];
    target?.focus();
  }, [focusedIndex, isOpen]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle keyboard navigation: Escape closes, Arrow Up/Down moves focus through items
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, events.length - 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusedIndex((prev) => {
          if (prev <= 0) {
            // Wrap back up to the bell button
            buttonRef.current?.focus();
            return -1;
          }
          return prev - 1;
        });
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        setFocusedIndex(0);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        setFocusedIndex(events.length - 1);
      }
    },
    [isOpen, events.length],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleNotificationClick = (event: NotificationCenterEvent) => {
    if (!event.read) {
      onMarkAsRead(event.id);
    }
    if (event.link) {
      router.push(event.link.href);
      setIsOpen(false);
    }
  };

  const handleTogglePanel = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="relative">
      {/*
       * aria-live polite region — announces new notifications to screen readers
       * without interrupting the current reading flow.
       */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={handleTogglePanel}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          'relative p-2 text-[#777777] hover:text-[#c9a962] transition-colors',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]',
          'rounded',
        )}
        title={`Notifications (${unreadCount} unread)`}
      >
        {/* Bell Icon */}
        <Icon name="bell" size={20} />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute top-1 right-1 min-w-[20px] h-5 px-1 rounded-full',
              'bg-[#c9a962] text-[#0a0a0a] text-[10px] font-bold',
              'flex items-center justify-center',
            )}
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadBadgeText}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <NotificationPanel
          ref={panelRef}
          events={events}
          loading={loading}
          onNotificationClick={handleNotificationClick}
          onMarkAllAsRead={onMarkAllAsRead}
          onRemoveEvent={onRemoveEvent}
          onClearAll={onClearAll}
        />
      )}
    </div>
  );
}

export default NotificationCenter;
