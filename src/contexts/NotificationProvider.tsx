'use client';

/**
 * #1042 — Unified NotificationProvider
 *
 * Collapses the two previous notification surfaces into a single context:
 *
 *   Toast (transient)         — ephemeral banners that auto-dismiss after 5 s.
 *                               Used for inline feedback (copy, submit, error).
 *
 *   NotificationCenter (persistent) — persisted event log (price alerts,
 *                               transaction updates, tier changes).
 *                               Survives page reloads via localStorage.
 *
 * Call sites should import `useNotification` from this file instead of
 * reaching directly into `ToastContext` or `useNotificationCenter`.
 *
 * Backward-compat re-exports keep the existing ToastProvider/useToast aliases
 * working during a phased migration so nothing breaks before all call sites
 * are updated.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { logger } from '@/lib/logger';
import { PriceAlertStorage } from '@/lib/price-alerts';
import { formatNumber } from '@/lib/format';

// ---------------------------------------------------------------------------
// Toast types (transient notifications)
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// ---------------------------------------------------------------------------
// Notification-Center event types (persistent)
// ---------------------------------------------------------------------------

export type NotificationEventType =
  | 'price_alert'
  | 'transaction_update'
  | 'tier_change'
  | 'payout_update';

export interface NotificationEvent {
  id: string;
  type: NotificationEventType;
  title: string;
  description: string;
  read: boolean;
  createdAt: number;
  link?: { href: string; label: string };
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Unified context value
// ---------------------------------------------------------------------------

interface NotificationContextValue {
  // ----- Toast API -----
  toasts: Toast[];
  /** Show a transient toast banner. */
  showToast: (message: string, type?: ToastType) => void;
  /** Imperatively dismiss a toast. */
  removeToast: (id: string) => void;

  // ----- Notification-center API -----
  events: NotificationEvent[];
  unreadCount: number;
  unreadBadgeText: string;
  notificationLoading: boolean;
  /** Add or update a persistent notification event. */
  addEvent: (event: NotificationEvent) => void;
  markAsRead: (eventId: string) => void;
  markAllAsRead: () => void;
  removeEvent: (eventId: string) => void;
  clearAll: () => void;
  addTierChangeEvent: (tier: string, previousTier?: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOAST_TTL_MS = 5_000;
const STORAGE_KEY = 'stellar_spend_notification_center';
const MAX_EVENTS = 100;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NotificationProvider({
  children,
  /** Wallet address — required to load persisted events for this user. */
  userAddress = null,
}: {
  children: ReactNode;
  userAddress?: string | null;
}) {
  // --- Toast state ---
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_TTL_MS);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // --- Notification-center state ---
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist events to localStorage
  const persistEvents = useCallback((evts: NotificationEvent[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(evts.slice(0, MAX_EVENTS)));
    } catch (err) {
      logger.error('notification_provider.persist_failed', {}, err);
    }
  }, []);

  // Load events from localStorage
  const loadEvents = useCallback((): NotificationEvent[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return (JSON.parse(raw) as NotificationEvent[]).sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      logger.error('notification_provider.load_failed', {}, err);
    }
    return [];
  }, []);

  // Add or update a single event
  const addEvent = useCallback(
    (event: NotificationEvent) => {
      setEvents((prev) => {
        const idx = prev.findIndex((e) => e.id === event.id);
        const next = idx >= 0
          ? prev.map((e, i) => (i === idx ? event : e))
          : [event, ...prev].slice(0, MAX_EVENTS);
        persistEvents(next);
        return next;
      });
    },
    [persistEvents],
  );

  const markAsRead = useCallback(
    (eventId: string) => {
      setEvents((prev) => {
        const next = prev.map((e) => (e.id === eventId ? { ...e, read: true } : e));
        persistEvents(next);
        return next;
      });
    },
    [persistEvents],
  );

  const markAllAsRead = useCallback(() => {
    setEvents((prev) => {
      const next = prev.map((e) => ({ ...e, read: true }));
      persistEvents(next);
      return next;
    });
  }, [persistEvents]);

  const removeEvent = useCallback(
    (eventId: string) => {
      setEvents((prev) => {
        const next = prev.filter((e) => e.id !== eventId);
        persistEvents(next);
        return next;
      });
    },
    [persistEvents],
  );

  const clearAll = useCallback(() => {
    persistEvents([]);
    setEvents([]);
  }, [persistEvents]);

  const addTierChangeEvent = useCallback(
    (tier: string, previousTier?: string) => {
      addEvent({
        id: `tier-change-${Date.now()}`,
        type: 'tier_change',
        title: 'Tier Changed',
        description: previousTier
          ? `Your tier has been upgraded from ${previousTier} to ${tier}`
          : `Your tier has been set to ${tier}`,
        read: false,
        createdAt: Date.now(),
        link: { href: '/account/tier', label: 'View Tier Details' },
        metadata: { tier, previousTier },
      });
    },
    [addEvent],
  );

  // Aggregate triggered price alerts as events
  const aggregatePriceAlerts = useCallback(() => {
    try {
      const triggered = PriceAlertStorage.getAllAlerts().filter(
        (a) => a.status === 'triggered' || a.triggeredCount > 0,
      );
      triggered.forEach((alert) => {
        const lastTrigger = alert.triggerHistory?.[0];
        if (!lastTrigger) return;
        addEvent({
          id: `price-alert-${alert.id}`,
          type: 'price_alert',
          title: `Price Alert: ${alert.currency}`,
          description: `Your alert for ${alert.currency} at ₦${formatNumber(alert.targetPrice)} has been triggered at ₦${formatNumber(lastTrigger.priceAtTrigger)}`,
          read: false,
          createdAt: lastTrigger.timestamp,
          link: { href: `/price-alerts/${alert.id}`, label: 'View Alert' },
          metadata: {
            alertId: alert.id,
            currency: alert.currency,
            targetPrice: alert.targetPrice,
            triggerPrice: lastTrigger.priceAtTrigger,
          },
        });
      });
    } catch (err) {
      logger.error('notification_provider.aggregate_price_alerts_failed', {}, err);
    }
  }, [addEvent]);

  // Initialise events from storage + aggregate price alerts
  useEffect(() => {
    if (!userAddress) {
      setNotificationLoading(false);
      return;
    }
    try {
      const persisted = loadEvents();
      setEvents(persisted);
      aggregatePriceAlerts();
    } catch (err) {
      logger.error('notification_provider.init_failed', {}, err);
    } finally {
      setNotificationLoading(false);
    }
  }, [userAddress, loadEvents, aggregatePriceAlerts]);

  // Poll for new price-alert events every 30 s while a user is connected
  useEffect(() => {
    if (!userAddress) return;
    pollRef.current = setInterval(aggregatePriceAlerts, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [userAddress, aggregatePriceAlerts]);

  const unreadCount = events.filter((e) => !e.read).length;
  const unreadBadgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        events,
        unreadCount,
        unreadBadgeText,
        notificationLoading,
        addEvent,
        markAsRead,
        markAllAsRead,
        removeEvent,
        clearAll,
        addTierChangeEvent,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Primary hook — returns the full unified notification API.
 * Must be used inside `<NotificationProvider>`.
 */
export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}

/**
 * Convenience hook for call sites that only need the toast API.
 * Drop-in replacement for the old `useToast()`.
 */
export function useToast() {
  const { toasts, showToast, removeToast } = useNotification();
  return { toasts, showToast, removeToast };
}

/**
 * Convenience hook for call sites that only need the notification-center API.
 */
export function useNotificationEvents() {
  const {
    events,
    unreadCount,
    unreadBadgeText,
    notificationLoading,
    addEvent,
    markAsRead,
    markAllAsRead,
    removeEvent,
    clearAll,
    addTierChangeEvent,
  } = useNotification();
  return {
    events,
    unreadCount,
    unreadBadgeText,
    loading: notificationLoading,
    addEvent,
    markAsRead,
    markAllAsRead,
    removeEvent,
    clearAll,
    addTierChangeEvent,
  };
}

// ---------------------------------------------------------------------------
// Backward-compat re-exports (keep existing imports from ToastContext working)
// These can be removed once all call sites use useNotification/useToast
// from this file.
// ---------------------------------------------------------------------------

/** @deprecated Import useToast from NotificationProvider instead */
export { useToast as useToastCompat };
