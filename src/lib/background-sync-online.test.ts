import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useOnlineStatus } from './background-sync';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

describe('useOnlineStatus (#1277)', () => {
  afterEach(() => {
    setOnline(true);
    vi.restoreAllMocks();
  });

  it('reflects the initial navigator.onLine value', () => {
    setOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('updates when the browser fires offline and online events', () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('registers exactly one online and one offline listener, removed on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useOnlineStatus());

    const added = addSpy.mock.calls
      .map(([type]) => type)
      .filter((t) => t === 'online' || t === 'offline');
    expect(added).toEqual(['online', 'offline']);

    unmount();

    const removed = removeSpy.mock.calls
      .map(([type]) => type)
      .filter((t) => t === 'online' || t === 'offline');
    expect(removed).toEqual(['online', 'offline']);
  });
});
