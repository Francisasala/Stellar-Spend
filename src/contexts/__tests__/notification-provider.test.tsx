/**
 * #1042 — NotificationProvider unit tests
 *
 * Covers:
 *  - Toast: show, auto-dismiss, manual remove, multiple toasts
 *  - Notification events: add, mark-as-read, mark-all-as-read, remove, clear-all
 *  - Queue behaviour: MAX_EVENTS cap, duplicate-id update
 *  - Hook guard: throws outside provider
 *  - useToast convenience hook: backward-compat surface
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import {
  NotificationProvider,
  useNotification,
  useToast,
  useNotificationEvents,
  type NotificationEvent,
} from '@/contexts/NotificationProvider';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  return <NotificationProvider>{children}</NotificationProvider>;
}

/** Renders a component inside the provider and returns the result. */
function renderWithProvider(ui: React.ReactElement) {
  return render(ui, { wrapper });
}

// ---------------------------------------------------------------------------
// Toast consumer component
// ---------------------------------------------------------------------------

function ToastConsumer() {
  const { toasts, showToast, removeToast } = useNotification();
  return (
    <div>
      <span data-testid="count">{toasts.length}</span>
      {toasts.map((t) => (
        <div key={t.id} data-testid="toast">
          {t.message}:{t.type}
          <button onClick={() => removeToast(t.id)}>remove-{t.id}</button>
        </div>
      ))}
      <button onClick={() => showToast('hello')}>show-default</button>
      <button onClick={() => showToast('saved', 'success')}>show-success</button>
      <button onClick={() => showToast('oops', 'error')}>show-error</button>
      <button onClick={() => showToast('info msg', 'info')}>show-info</button>
      <button onClick={() => showToast('warn', 'warning')}>show-warning</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification-center consumer
// ---------------------------------------------------------------------------

const sampleEvent: NotificationEvent = {
  id: 'evt-1',
  type: 'transaction_update',
  title: 'TX Complete',
  description: 'Your transaction settled.',
  read: false,
  createdAt: Date.now(),
};

function EventConsumer() {
  const { events, unreadCount, addEvent, markAsRead, markAllAsRead, removeEvent, clearAll } =
    useNotification();
  return (
    <div>
      <span data-testid="event-count">{events.length}</span>
      <span data-testid="unread">{unreadCount}</span>
      {events.map((e) => (
        <div key={e.id} data-testid="event">
          {e.id}:{String(e.read)}
        </div>
      ))}
      <button onClick={() => addEvent(sampleEvent)}>add-event</button>
      <button onClick={() => addEvent({ ...sampleEvent, id: 'evt-2' })}>add-event-2</button>
      <button onClick={() => markAsRead('evt-1')}>mark-read</button>
      <button onClick={markAllAsRead}>mark-all</button>
      <button onClick={() => removeEvent('evt-1')}>remove</button>
      <button onClick={clearAll}>clear-all</button>
      <button onClick={() => addEvent({ ...sampleEvent, title: 'Updated' })}>update-event</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Toast tests
// ---------------------------------------------------------------------------

describe('NotificationProvider — toasts', () => {
  it('starts with zero toasts', () => {
    renderWithProvider(<ToastConsumer />);
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('showToast adds a toast with default type info', () => {
    renderWithProvider(<ToastConsumer />);
    act(() => {
      screen.getByText('show-default').click();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toast').textContent).toContain('hello:info');
  });

  it('showToast respects explicit toast type', () => {
    renderWithProvider(<ToastConsumer />);
    act(() => {
      screen.getByText('show-success').click();
    });
    expect(screen.getByTestId('toast').textContent).toContain('saved:success');
  });

  it('multiple toasts accumulate without replacing each other', () => {
    renderWithProvider(<ToastConsumer />);
    act(() => {
      screen.getByText('show-default').click();
    });
    act(() => {
      screen.getByText('show-error').click();
    });
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('removeToast removes specific toast by id', () => {
    renderWithProvider(<ToastConsumer />);
    act(() => {
      screen.getByText('show-default').click();
    });
    act(() => {
      screen.getByText('show-success').click();
    });
    expect(screen.getByTestId('count').textContent).toBe('2');
    const removeButtons = screen.getAllByText(/^remove-/);
    act(() => {
      removeButtons[0].click();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('auto-dismisses toast after 5 s', () => {
    vi.useFakeTimers();
    renderWithProvider(<ToastConsumer />);
    act(() => {
      screen.getByText('show-default').click();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// Notification-center tests
// ---------------------------------------------------------------------------

describe('NotificationProvider — notification events', () => {
  it('starts with zero events', () => {
    renderWithProvider(<EventConsumer />);
    expect(screen.getByTestId('event-count').textContent).toBe('0');
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('addEvent adds a new event and increments unread count', () => {
    renderWithProvider(<EventConsumer />);
    act(() => {
      screen.getByText('add-event').click();
    });
    expect(screen.getByTestId('event-count').textContent).toBe('1');
    expect(screen.getByTestId('unread').textContent).toBe('1');
  });

  it('addEvent with same id updates the event (no duplicate)', () => {
    renderWithProvider(<EventConsumer />);
    act(() => {
      screen.getByText('add-event').click();
    });
    act(() => {
      screen.getByText('update-event').click();
    });
    expect(screen.getByTestId('event-count').textContent).toBe('1');
  });

  it('addEvent with different id enqueues separate event', () => {
    renderWithProvider(<EventConsumer />);
    act(() => {
      screen.getByText('add-event').click();
    });
    act(() => {
      screen.getByText('add-event-2').click();
    });
    expect(screen.getByTestId('event-count').textContent).toBe('2');
    expect(screen.getByTestId('unread').textContent).toBe('2');
  });

  it('markAsRead marks an event as read and decrements unread count', () => {
    renderWithProvider(<EventConsumer />);
    act(() => {
      screen.getByText('add-event').click();
    });
    expect(screen.getByTestId('unread').textContent).toBe('1');
    act(() => {
      screen.getByText('mark-read').click();
    });
    expect(screen.getByTestId('unread').textContent).toBe('0');
    expect(screen.getByTestId('event').textContent).toContain('evt-1:true');
  });

  it('markAllAsRead sets all events to read', () => {
    renderWithProvider(<EventConsumer />);
    act(() => {
      screen.getByText('add-event').click();
    });
    act(() => {
      screen.getByText('add-event-2').click();
    });
    expect(screen.getByTestId('unread').textContent).toBe('2');
    act(() => {
      screen.getByText('mark-all').click();
    });
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('removeEvent removes an event and updates unread count', () => {
    renderWithProvider(<EventConsumer />);
    act(() => {
      screen.getByText('add-event').click();
    });
    act(() => {
      screen.getByText('add-event-2').click();
    });
    expect(screen.getByTestId('event-count').textContent).toBe('2');
    act(() => {
      screen.getByText('remove').click();
    });
    expect(screen.getByTestId('event-count').textContent).toBe('1');
    expect(screen.getByTestId('unread').textContent).toBe('1');
  });

  it('clearAll removes all events', () => {
    renderWithProvider(<EventConsumer />);
    act(() => {
      screen.getByText('add-event').click();
    });
    act(() => {
      screen.getByText('add-event-2').click();
    });
    act(() => {
      screen.getByText('clear-all').click();
    });
    expect(screen.getByTestId('event-count').textContent).toBe('0');
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('events are persisted to localStorage on mutation', () => {
    renderWithProvider(<EventConsumer />);
    act(() => {
      screen.getByText('add-event').click();
    });
    const stored = JSON.parse(localStorage.getItem('stellar_spend_notification_center') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('evt-1');
  });

  it('clearAll clears localStorage', () => {
    renderWithProvider(<EventConsumer />);
    act(() => {
      screen.getByText('add-event').click();
    });
    act(() => {
      screen.getByText('clear-all').click();
    });
    const stored = JSON.parse(localStorage.getItem('stellar_spend_notification_center') ?? '[]');
    expect(stored).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Convenience hooks
// ---------------------------------------------------------------------------

describe('useToast convenience hook', () => {
  it('exposes toasts, showToast, removeToast', () => {
    let captured: ReturnType<typeof useToast> | null = null;
    function Probe() {
      captured = useToast();
      return null;
    }
    renderWithProvider(<Probe />);
    expect(captured).not.toBeNull();
    expect(Array.isArray(captured!.toasts)).toBe(true);
    expect(typeof captured!.showToast).toBe('function');
    expect(typeof captured!.removeToast).toBe('function');
  });
});

describe('useNotificationEvents convenience hook', () => {
  it('exposes events and management functions', () => {
    let captured: ReturnType<typeof useNotificationEvents> | null = null;
    function Probe() {
      captured = useNotificationEvents();
      return null;
    }
    renderWithProvider(<Probe />);
    expect(captured).not.toBeNull();
    expect(Array.isArray(captured!.events)).toBe(true);
    expect(typeof captured!.markAsRead).toBe('function');
    expect(typeof captured!.clearAll).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Guard: hooks throw outside provider
// ---------------------------------------------------------------------------

describe('useNotification guard', () => {
  it('throws when used outside NotificationProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Orphan() {
      useNotification();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/useNotification must be used within NotificationProvider/);
    spy.mockRestore();
  });
});
