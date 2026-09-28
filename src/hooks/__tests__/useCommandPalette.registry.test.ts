import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  buildAppCommands,
  createCommandRegistry,
  type CommandAction,
  type ICommandRegistry,
} from '../../lib/command-registry';
import { useCommandPalette } from '../../hooks/useCommandPalette';

// ---------------------------------------------------------------------------
// #1182 — command-registry standalone tests (no hook wiring)
// ---------------------------------------------------------------------------

describe('command-registry – ICommandRegistry interface (#1182)', () => {
  it('createCommandRegistry returns an ICommandRegistry', () => {
    const registry = createCommandRegistry({ router: { push: vi.fn() } });
    expect(typeof registry.getCommands).toBe('function');
    const cmds = registry.getCommands();
    expect(Array.isArray(cmds)).toBe(true);
    expect(cmds.length).toBeGreaterThan(0);
  });

  it('registry is testable without a hook (plain object satisfies ICommandRegistry)', () => {
    const stub: ICommandRegistry = {
      getCommands: () => [
        { id: 'test-cmd', label: 'Test', action: vi.fn() },
      ],
    };
    expect(stub.getCommands()).toHaveLength(1);
    expect(stub.getCommands()[0].id).toBe('test-cmd');
  });

  it('buildAppCommands result can be wrapped in createCommandRegistry', () => {
    const router = { push: vi.fn() };
    const registry = createCommandRegistry({ router });
    const cmds = registry.getCommands();

    // Verify all commands have required fields
    cmds.forEach((cmd: CommandAction) => {
      expect(typeof cmd.id).toBe('string');
      expect(typeof cmd.label).toBe('string');
      expect(typeof cmd.action).toBe('function');
    });
  });

  it('registry is isolated from the hook lifecycle', () => {
    // Build commands directly without rendering any hook
    const router = { push: vi.fn() };
    const registry = createCommandRegistry({
      router,
      onConnectWallet: vi.fn(),
      onToggleTheme: vi.fn(),
    });

    const connectCmd = registry.getCommands().find((c) => c.id === 'action-connect-wallet');
    expect(connectCmd).toBeDefined();
    connectCmd!.action();
    // If we got here without a React component mounted, the registry is
    // properly decoupled from the hook.
  });

  it('ICommandRegistry contract: getCommands() is stable across calls on same instance', () => {
    const registry = createCommandRegistry({ router: { push: vi.fn() } });
    const first = registry.getCommands();
    const second = registry.getCommands();
    // Same length and same ids (structural stability)
    expect(first.length).toBe(second.length);
    expect(first.map((c) => c.id)).toEqual(second.map((c) => c.id));
  });
});

// ---------------------------------------------------------------------------
// #1182 — useCommandPalette + registry integration tests
// ---------------------------------------------------------------------------

describe('useCommandPalette – registry integration (#1182)', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'platform', {
      writable: true,
      value: 'Win32',
    });
  });

  it('commands is empty when no registry is provided', () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.commands).toEqual([]);
  });

  it('commands are populated when a registry is provided', () => {
    const stub: ICommandRegistry = {
      getCommands: () => [
        { id: 'a', label: 'A', action: vi.fn() },
        { id: 'b', label: 'B', action: vi.fn() },
      ],
    };

    const { result } = renderHook(() => useCommandPalette({ registry: stub }));
    expect(result.current.commands).toHaveLength(2);
    expect(result.current.commands[0].id).toBe('a');
  });

  it('commands come from createCommandRegistry when wired up', () => {
    const registry = createCommandRegistry({ router: { push: vi.fn() } });
    const { result } = renderHook(() => useCommandPalette({ registry }));

    expect(result.current.commands.length).toBeGreaterThan(0);
    const ids = result.current.commands.map((c) => c.id);
    expect(ids).toContain('nav-home');
    expect(ids).toContain('action-connect-wallet');
  });

  it('open/close/toggle still work when a registry is injected', () => {
    const stub: ICommandRegistry = { getCommands: () => [] };
    const { result } = renderHook(() => useCommandPalette({ registry: stub }));

    expect(result.current.isOpen).toBe(false);
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('onCommandExecute still tracks recent commands when a registry is injected', () => {
    const stub: ICommandRegistry = { getCommands: () => [] };
    const { result } = renderHook(() => useCommandPalette({ registry: stub }));

    act(() => result.current.onCommandExecute('cmd1'));
    act(() => result.current.onCommandExecute('cmd2'));

    expect(result.current.recentCommands).toEqual(['cmd2', 'cmd1']);
  });

  it('a test-double registry can be swapped without touching hook internals', () => {
    let callCount = 0;
    const spy: ICommandRegistry = {
      getCommands: () => {
        callCount++;
        return [{ id: 'spy-cmd', label: 'Spy', action: vi.fn() }];
      },
    };

    const { result } = renderHook(() => useCommandPalette({ registry: spy }));
    // getCommands was called (at least once) during render
    expect(callCount).toBeGreaterThan(0);
    expect(result.current.commands[0].id).toBe('spy-cmd');
  });
});
