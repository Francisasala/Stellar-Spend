'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import type { CommandAction, ICommandRegistry } from '@/lib/command-registry';

// ---------------------------------------------------------------------------
// #1182 — Decouple useCommandPalette from command-registry internals
//
// The hook now depends on the ICommandRegistry *interface* only.
// Pass a concrete registry (createCommandRegistry) in production, or a test
// double that satisfies ICommandRegistry without a router / Next.js env.
// ---------------------------------------------------------------------------

const RECENT_COMMANDS_KEY = 'stellar_spend_recent_commands';
const MAX_RECENT = 5;

export interface UseCommandPaletteOptions {
  /**
   * Optional registry that supplies the list of available commands.
   * When omitted the hook manages only open/close state and recent-command
   * tracking — the command list is empty.  Pass `createCommandRegistry(...)`
   * from `@/lib/command-registry` to wire up the full command set.
   */
  registry?: ICommandRegistry;
}

export interface UseCommandPaletteResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  recentCommands: string[];
  onCommandExecute: (commandId: string) => void;
  /** Commands supplied by the registry, or [] when no registry is provided. */
  commands: CommandAction[];
}

export function useCommandPalette(
  options: UseCommandPaletteOptions = {},
): UseCommandPaletteResult {
  const { registry } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  // Derive commands from the registry — empty array when none is provided so
  // callers that only need open/close tracking don't pay for a registry build.
  const commands: CommandAction[] = registry ? registry.getCommands() : [];

  // Load recent commands from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
      if (stored) {
        setRecentCommands(JSON.parse(stored));
      }
    } catch (error) {
      logger.error('command_palette.load_recent_failed', {}, error);
    }
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const onCommandExecute = useCallback((commandId: string) => {
    setRecentCommands((prev) => {
      // Remove if already exists, add to front
      const filtered = prev.filter((id) => id !== commandId);
      const updated = [commandId, ...filtered].slice(0, MAX_RECENT);

      try {
        localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(updated));
      } catch (error) {
        logger.error('command_palette.save_recent_failed', {}, error);
      }

      return updated;
    });
  }, []);

  // Listen for Cmd/Ctrl+K globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const isCommandK = e.key === 'k' && (isMac ? e.metaKey : e.ctrlKey);

      if (isCommandK) {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return {
    isOpen,
    open,
    close,
    toggle,
    recentCommands,
    onCommandExecute,
    commands,
  };
}
