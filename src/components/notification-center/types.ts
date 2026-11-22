import type { NotificationCenterEvent } from '@/hooks/useNotificationCenter';

export interface NotificationCenterProps {
  events: NotificationCenterEvent[];
  unreadCount: number;
  unreadBadgeText: string;
  loading: boolean;
  onMarkAsRead: (eventId: string) => void;
  onMarkAllAsRead: () => void;
  onRemoveEvent: (eventId: string) => void;
  onClearAll: () => void;
}

/**
 * Shared state model for the NotificationCenter reducer/context.
 * Kept in sync with the public `NotificationCenterProps` shape so the
 * component can remain backwards compatible while consumers migrate to
 * the context-based API.
 */
export interface NotificationState {
  events: NotificationCenterEvent[];
  unreadCount: number;
  unreadBadgeText: string;
  loading: boolean;
}

export type NotificationAction =
  | { type: 'SET_EVENTS'; events: NotificationCenterEvent[] }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'MARK_AS_READ'; eventId: string }
  | { type: 'MARK_ALL_AS_READ' }
  | { type: 'REMOVE_EVENT'; eventId: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'RESET'; state: NotificationState };

export interface NotificationContextValue extends NotificationState {
  markAsRead: (eventId: string) => void;
  markAllAsRead: () => void;
  removeEvent: (eventId: string) => void;
  clearAll: () => void;
}

export function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function getEventTypeColor(type: string): string {
  switch (type) {
    case 'price_alert':
      return 'text-amber-400';
    case 'transaction_update':
      return 'text-blue-400';
    case 'payout_update':
      return 'text-emerald-400';
    case 'tier_change':
      return 'text-purple-400';
    default:
      return 'text-slate-400';
  }
}
