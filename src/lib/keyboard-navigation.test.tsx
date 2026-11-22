import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  useFocusTrap,
  useKeyboardShortcuts,
  getFocusableElements,
  focusNextElement,
  focusPreviousElement,
  announceToScreenReader,
} from './keyboard-navigation';

function Modal({ returnFocus = true }: { returnFocus?: boolean }) {
  const ref = useFocusTrap({ returnFocus });
  return (
    <div ref={ref} data-testid="modal">
      <button>first</button>
      <button>middle</button>
      <button>last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves focus to the first focusable element on mount', () => {
    render(<Modal />);
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('wraps Tab from the last element back to the first', () => {
    render(<Modal />);
    const modal = screen.getByTestId('modal');
    const last = screen.getByRole('button', { name: 'last' });
    act(() => last.focus());

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => {
      modal.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the first element to the last', () => {
    render(<Modal />);
    const modal = screen.getByTestId('modal');

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      modal.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'last' })).toHaveFocus();
  });

  it('leaves Tab alone when focus is not on a boundary element', () => {
    render(<Modal />);
    const modal = screen.getByTestId('modal');
    act(() => screen.getByRole('button', { name: 'middle' }).focus());

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => {
      modal.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores non-Tab keys', () => {
    render(<Modal />);
    const modal = screen.getByTestId('modal');
    act(() => screen.getByRole('button', { name: 'last' }).focus());

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => {
      modal.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
  });

  it('returns focus to the previously focused element on unmount', () => {
    const opener = document.createElement('button');
    opener.textContent = 'open';
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<Modal />);
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('does not restore focus when returnFocus is false', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<Modal returnFocus={false} />);
    unmount();

    expect(opener).not.toHaveFocus();
    opener.remove();
  });
});

describe('useKeyboardShortcuts', () => {
  function fireKey(init: KeyboardEventInit, target: EventTarget = window) {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  it('runs the action for a matching key', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', action, description: 'k' }]));

    fireKey({ key: 'k' });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('matches case-insensitively', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', action, description: 'k' }]));

    fireKey({ key: 'K' });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('requires ctrl when the shortcut declares it', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 's', ctrl: true, action, description: 'save' }]));

    fireKey({ key: 's' });
    expect(action).not.toHaveBeenCalled();

    fireKey({ key: 's', ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not fire when shift state differs from the shortcut', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'j', action, description: 'j' }]));

    fireKey({ key: 'j', shiftKey: true });
    expect(action).not.toHaveBeenCalled();
  });

  it('ignores key presses that originate in form fields', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', action, description: 'k' }]));

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireKey({ key: 'k' }, input);
    expect(action).not.toHaveBeenCalled();
    input.remove();
  });

  it('does nothing when disabled', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', action, description: 'k' }], false));

    fireKey({ key: 'k' });
    expect(action).not.toHaveBeenCalled();
  });

  it('removes its listener on unmount', () => {
    const action = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts([{ key: 'k', action, description: 'k' }]),
    );

    unmount();
    fireKey({ key: 'k' });
    expect(action).not.toHaveBeenCalled();
  });
});

describe('focus helpers', () => {
  function Group() {
    return (
      <div data-testid="group">
        <button>a</button>
        <div>not focusable</div>
        <a href="#x">b</a>
        <input aria-label="c" />
      </div>
    );
  }

  it('getFocusableElements returns only focusable controls', () => {
    render(<Group />);
    const group = screen.getByTestId('group');
    const names = getFocusableElements(group).map(
      (el) => el.textContent || el.getAttribute('aria-label'),
    );
    expect(names).toEqual(['a', 'b', 'c']);
  });

  it('focusNextElement advances and wraps to the start', () => {
    render(<Group />);
    const group = screen.getByTestId('group');
    const [a, b, c] = getFocusableElements(group);

    focusNextElement(group, a);
    expect(b).toHaveFocus();

    focusNextElement(group, c);
    expect(a).toHaveFocus();
  });

  it('focusPreviousElement moves back and wraps to the end', () => {
    render(<Group />);
    const group = screen.getByTestId('group');
    const [a, , c] = getFocusableElements(group);

    focusPreviousElement(group, a);
    expect(c).toHaveFocus();
  });
});

describe('announceToScreenReader', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('adds a polite live region with the message', () => {
    announceToScreenReader('Saved');
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Saved');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('uses assertive politeness when requested', () => {
    announceToScreenReader('Error', 'assertive');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive');
  });

  it('removes the announcement after one second', () => {
    vi.useFakeTimers();
    announceToScreenReader('Done');
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
