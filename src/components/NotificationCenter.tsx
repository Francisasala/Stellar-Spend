'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/Icon';
import { useTranslations } from '@/lib/i18n';
import type { NotificationCenterEvent } from '@/hooks/useNotificationCenter';
import type { NotificationCenterProps } from './notification-center/types';
import { NotificationPanel } from './notification-center/NotificationPanel';
import { useNotificationEvents } from './notification-center/NotificationCenterContext';

export * from './notification-center/types';

const BELL_ICON_SIZE = 20;
const ANNOUNCEMENT_CLEAR_DELAY_MS = 2000;
const NOTIFICATION_ITEM_BUTTON_SELECTOR = 'li button:first-of-type';

function NotificationCenterComponent({
  events,
  unreadCount,
  unreadBadgeText,
  loading,
  onMarkAsRead,
  onMarkAllAsRead,
  onRemoveEvent,
  onClearAll,
}: NotificationCenterProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = useTranslations('notificationCenter');

  // All panel/announcement/focus state lives in the shared notification context.
  // Props remain the source of truth for backwards compatibility.
  const { isOpen, focusedIndex, announcement, togglePanel, closePanel, setFocusedIndex } =
    useNotificationEvents({ events });

  // Move focus into the panel when it opens, and restore focus to the bell
  // button when it closes (e.g. via Escape or outside click).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Focus the first focusable element inside the panel on open
      const panel = panelRef.current;
      const firstFocusable = panel?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    } else if (!isOpen && wasOpenRef.current) {
      buttonRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Focus the correct notification button when focusedIndex changes
  useEffect(() => {
    if (!isOpen || focusedIndex < 0) return;
    const panel = panelRef.current;
    if (!panel) return;
    const buttons = panel.querySelectorAll<HTMLButtonElement>(NOTIFICATION_ITEM_BUTTON_SELECTOR);
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
        closePanel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closePanel]);

  // Handle keyboard navigation: Escape closes, Arrow Up/Down moves focus through items
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        closePanel();
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
    [isOpen, events.length, closePanel, setFocusedIndex],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleNotificationClick = useCallback(
    (event: NotificationCenterEvent) => {
      if (!event.read) {
        onMarkAsRead(event.id);
      }
      if (event.link) {
        router.push(event.link.href);
        closePanel();
      }
    },
    [onMarkAsRead, router, closePanel],
  );

  const handleTogglePanel = useCallback(() => {
    togglePanel();
  }, [togglePanel]);

  const bellAriaLabel = useMemo(
    () => t('bell.ariaLabel', { count: unreadCount }),
    [t, unreadCount],
  );

  const unreadAriaLabel = useMemo(
    () => t('badge.ariaLabel', { count: unreadCount }),
    [t, unreadCount],
  );

  return (
    <div className="relative">
      {/*
       * aria-live polite region — announces new notifications to screen readers
       * without interrupting the current reading flow.
       */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={handleTogglePanel}
        aria-label={bellAriaLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="notification-center-panel"
        className={cn(
          'relative p-2 text-[#777777] hover:text-[#c9a962] transition-colors',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962]',
          'rounded',
        )}
        title={bellAriaLabel}
      >
        {/* Bell Icon */}
        <Icon name="bell" size={BELL_ICON_SIZE} />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute top-1 right-1 min-w-[20px] h-5 px-1 rounded-full',
              'bg-[#c9a962] text-[#0a0a0a] text-[10px] font-bold',
              'flex items-center justify-center',
            )}
            aria-label={unreadAriaLabel}
          >
            {unreadBadgeText}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <NotificationPanel
          ref={panelRef}
          id="notification-center-panel"
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

export const NotificationCenter = memo(NotificationCenterComponent);
NotificationCenter.displayName = 'NotificationCenter';
