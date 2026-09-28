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
