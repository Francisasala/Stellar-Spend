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
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { logger } from '@/lib/logger';
import { randomHex } from '@/lib/crypto/ids';
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

/**
 * Shape of the value exposed by {@link NotificationContext}.
 *
 * The context intentionally merges two previously separate surfaces:
 *
 * - **Toast API** (`toasts`, `showToast`, `removeToast`) — transient banners
 *   that auto-dismiss after {@link TOAST_TTL_MS}. No persistence.
 * - **Notification-center API** (`events`, `unreadCount`, `unreadBadgeText`,
 *   `notificationLoading`, `addEvent`, `markAsRead`, `markAllAsRead`,
 *   `removeEvent`, `clearAll`, `addTierChangeEvent`) — a persistent event log
 *   backed by `localStorage` under {@link STORAGE_KEY} and capped at
 *   {@link MAX_EVENTS} entries.
 *
 * Consumers should prefer the narrow hooks ({@link useToast},
 * {@link useNotificationEvents}) unless they genuinely need both surfaces.
 *
 * @example
 * ```tsx
 * function CopyButton() {
 *   const { showToast } = useToast();
 *   return <button onClick={() => showToast('Copied!', 'success')}>Copy</button>;
 * }
 * ```
 */
export interface NotificationContextValue {
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
// Notification-center reducer (#1428)
// ---------------------------------------------------------------------------

export interface NotificationState {
  events: NotificationEvent[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

export type NotificationAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; events: NotificationEvent[] }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'ADD_EVENT'; event: NotificationEvent }
  | { type: 'MARK_AS_READ'; eventId: string }
  | { type: 'MARK_ALL_AS_READ' }
  | { type: 'REMOVE_EVENT'; eventId: string }
  | { type: 'CLEAR_ALL' };

export const initialNotificationState: NotificationState = {
  events: [],
  unreadCount: 0,
  loading: true,
  error: null,
};

/** Sort newest-first and cap the event list. */
function normalizeEvents(events: NotificationEvent[]): NotificationEvent[] {
  return [...events].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_EVENTS);
}

function withDerived(state: NotificationState, events: NotificationEvent[]): NotificationState {
  const normalized = normalizeEvents(events);
  return {
    ...state,
    events: normalized,
    unreadCount: normalized.filter((e) => !e.read).length,
  };
}

/**
 * Pure reducer for notification-center state. Exported for unit testing.
 */
export function notificationReducer(
  state: NotificationState,
  action: NotificationAction,
): NotificationState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return withDerived({ ...state, loading: false, error: null }, action.events);
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'ADD_EVENT': {
      const idx = state.events.findIndex((e) => e.id === action.event.id);
      const next =
        idx >= 0
          ? state.events.map((e, i) => (i === idx ? action.event : e))
          : [action.event, ...state.events];
      return withDerived(state, next);
    }
    case 'MARK_AS_READ':
      return withDerived(
        state,
        state.events.map((e) => (e.id === action.eventId ? { ...e, read: true } : e)),
      );
    case 'MARK_ALL_AS_READ':
      return withDerived(
        state,
        state.events.map((e) => (e.read ? e : { ...e, read: true })),
      );
    case 'REMOVE_EVENT':
      return withDerived(
        state,
        state.events.filter((e) => e.id !== action.eventId),
      );
    case 'CLEAR_ALL':
      return withDerived(state, []);
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Single provider for all notification surfaces.
 *
 * Mount this once near the app root (it is wired up by `AppProviders`).
 * Do not nest additional `NotificationProvider` instances — the toast queue
 * and persisted event log are global, and a nested provider would create a
 * second, divergent copy of that state.
 *
 * @param props.children    React subtree that may consume the context.
 * @param props.userAddress Wallet address used to scope persisted events and
 *                          to enable price-alert polling. When `null`, the
 *                          notification center stays empty and idle.
 */
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
    const id = randomHex(6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_TTL_MS);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // --- Notification-center state (reducer-driven, #1428) ---
  const [state, dispatch] = useReducer(notificationReducer, initialNotificationState);
  const { events, unreadCount, loading: notificationLoading } = state;
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
      if (raw)
        return (JSON.parse(raw) as NotificationEvent[]).sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      logger.error('notification_provider.load_failed', {}, err);
    }
    return [];
  }, []);

  // Persist whenever the event list changes (single source of truth)
  useEffect(() => {
    persistEvents(events);
  }, [events, persistEvents]);

  // Add or update a single event
  const addEvent = useCallback((event: NotificationEvent) => {
    dispatch({ type: 'ADD_EVENT', event });
  }, []);

  const markAsRead = useCallback((eventId: string) => {
    dispatch({ type: 'MARK_AS_READ', eventId });
  }, []);

  const markAllAsRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_AS_READ' });
  }, []);

  const removeEvent = useCallback((eventId: string) => {
    dispatch({ type: 'REMOVE_EVENT', eventId });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

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
      dispatch({ type: 'LOAD_SUCCESS', events: [] });
      return;
    }
    dispatch({ type: 'LOAD_START' });
    try {
      const persisted = loadEvents();
      dispatch({ type: 'LOAD_SUCCESS', events: persisted });
      aggregatePriceAlerts();
    } catch (err) {
      logger.error('notification_provider.init_failed', {}, err);
      dispatch({ type: 'LOAD_ERROR', error: 'Failed to load notifications' });
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
// Backward-compat notes
//
// The legacy `ToastProvider` / `useToast` aliases are preserved by keeping the
// `NotificationProvider` and `useToast` export names stable. The former
// standalone `ToastContext` provider has been removed; all call sites should
// import from this module. No additional re-exports are needed.
// ---------------------------------------------------------------------------
