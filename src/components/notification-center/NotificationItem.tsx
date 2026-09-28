'use client';

import { cn } from '@/lib/cn';
import { Icon } from '@/components/Icon';
import type { NotificationCenterEvent } from '@/hooks/useNotificationCenter';
import { formatTime, getEventTypeColor } from './types';

export interface NotificationItemProps {
  event: NotificationCenterEvent;
  onClick: (event: NotificationCenterEvent) => void;
  onRemove: (eventId: string) => void;
}

export function getEventIcon(type: string) {
  switch (type) {
    case 'price_alert':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 1.5L11.5 8H4.5M11.5 8H4.5M8 14.5V8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'transaction_update':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 1.5v13m0 0L4.5 11m3.5 3.5l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'payout_update':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1" />
          <path d="M8 4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'tier_change':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 2L3 5v4c0 4 5 5 5 5s5-1 5-5V5l-5-3z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function NotificationItem({ event, onClick, onRemove }: NotificationItemProps) {
  return (
    <li
      className={cn(
        'relative px-4 py-3 border-l-4 transition-colors hover:bg-[#1a1a1a]',
        event.read ? 'border-[#222222] bg-[#0a0a0a]' : 'border-[#c9a962] bg-[#1a1a1a]',
      )}
    >
      <button
        onClick={() => onClick(event)}
        className={cn(
          'w-full text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962] rounded px-1',
          'transition-all',
        )}
        aria-label={`${event.title}: ${event.description}`}
      >
        <div className="flex items-start gap-2 mb-1">
          <span className={cn('shrink-0 mt-0.5', getEventTypeColor(event.type))}>
            {getEventIcon(event.type)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-white truncate">{event.title}</h4>
              {!event.read && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-[#c9a962]" aria-hidden="true" />
              )}
            </div>
            <p className="text-[11px] text-[#777777] mt-0.5 line-clamp-2">{event.description}</p>
            <p className="text-[10px] text-[#555555] mt-1">{formatTime(event.createdAt)}</p>
          </div>
        </div>

        {event.link && (
          <div className="mt-2 text-[10px]">
            <span className="inline-block px-2 py-1 bg-[#1a1a1a] text-[#c9a962] rounded hover:bg-[#222222]">
              {event.link.label}
            </span>
          </div>
        )}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(event.id);
        }}
        className="absolute right-2 top-2 text-[#555555] hover:text-[#777777] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a962] rounded"
        aria-label="Remove notification"
        title="Remove"
      >
        <Icon name="close" size={12} />
      </button>
    </li>
  );
}
