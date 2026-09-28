import { describe, it, expect, vi } from 'vitest';
import { buildAppCommands, type CommandAction } from '../command-registry';

describe('command-registry', () => {
  describe('buildAppCommands', () => {
    it('should build commands with only router dependency', () => {
      const router = { push: vi.fn() };

      const commands = buildAppCommands({ router });

      expect(commands).toBeDefined();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it('should include navigation commands', () => {
      const router = { push: vi.fn() };

      const commands = buildAppCommands({ router });

      const navCommands = commands.filter((cmd) => cmd.section === 'Navigation');
      expect(navCommands.length).toBeGreaterThan(0);

      const ids = navCommands.map((cmd) => cmd.id);
      expect(ids).toContain('nav-home');
      expect(ids).toContain('nav-history');
      expect(ids).toContain('nav-settings');
      expect(ids).toContain('nav-dashboard');
    });

    it('should include action commands', () => {
      const router = { push: vi.fn() };

      const commands = buildAppCommands({ router });

      const actionCommands = commands.filter((cmd) => cmd.section === 'Actions');
      expect(actionCommands.length).toBeGreaterThan(0);

      const ids = actionCommands.map((cmd) => cmd.id);
      expect(ids).toContain('action-new-offramp');
      expect(ids).toContain('action-connect-wallet');
      expect(ids).toContain('action-notifications');
    });

    it('should include appearance and help commands', () => {
      const router = { push: vi.fn() };

      const commands = buildAppCommands({ router });

      const sections = new Set(commands.map((cmd) => cmd.section));
      expect(sections).toContain('Appearance');
      expect(sections).toContain('Help');
    });

    it('should execute navigation commands without optional callbacks', () => {
      const router = { push: vi.fn() };

      const commands = buildAppCommands({ router });
      const homeCommand = commands.find((cmd) => cmd.id === 'nav-home');

      expect(homeCommand).toBeDefined();
      homeCommand!.action();
      expect(router.push).toHaveBeenCalledWith('/');
    });

    it('should call onConnect callback when provided', () => {
      const router = { push: vi.fn() };
      const onConnectWallet = vi.fn();

      const commands = buildAppCommands({ router, onConnectWallet });
      const connectCommand = commands.find((cmd) => cmd.id === 'action-connect-wallet');

      expect(connectCommand).toBeDefined();
      connectCommand!.action();
      expect(onConnectWallet).toHaveBeenCalled();
    });

    it('should call onNewOfframp callback when provided', () => {
      const router = { push: vi.fn() };
      const onNewOfframp = vi.fn();

      const commands = buildAppCommands({ router, onNewOfframp });
      const offrampCommand = commands.find((cmd) => cmd.id === 'action-new-offramp');

      expect(offrampCommand).toBeDefined();
      offrampCommand!.action();
      expect(onNewOfframp).toHaveBeenCalled();
    });

    it('should call onOpenSettings callback when provided', () => {
      const router = { push: vi.fn() };
      const onOpenSettings = vi.fn();

      const commands = buildAppCommands({ router, onOpenSettings });
      const settingsCommand = commands.find((cmd) => cmd.id === 'nav-settings');

      expect(settingsCommand).toBeDefined();
      settingsCommand!.action();
      expect(onOpenSettings).toHaveBeenCalled();
    });

    it('should call onToggleTheme callback when provided', () => {
      const router = { push: vi.fn() };
      const onToggleTheme = vi.fn();

      const commands = buildAppCommands({ router, onToggleTheme });
      const themeCommand = commands.find((cmd) => cmd.id === 'theme-toggle');

      expect(themeCommand).toBeDefined();
      themeCommand!.action();
      expect(onToggleTheme).toHaveBeenCalled();
    });

    it('should call onOpenNotifications callback when provided', () => {
      const router = { push: vi.fn() };
      const onOpenNotifications = vi.fn();

      const commands = buildAppCommands({ router, onOpenNotifications });
      const notifCommand = commands.find((cmd) => cmd.id === 'action-notifications');

      expect(notifCommand).toBeDefined();
      notifCommand!.action();
      expect(onOpenNotifications).toHaveBeenCalled();
    });

    it('should fallback to router.push when optional callbacks are not provided', () => {
      const router = { push: vi.fn() };

      const commands = buildAppCommands({ router });
      const settingsCommand = commands.find((cmd) => cmd.id === 'nav-settings');

      settingsCommand!.action();
      expect(router.push).toHaveBeenCalledWith('/settings');
    });

    it('should have all commands with required fields', () => {
      const router = { push: vi.fn() };

      const commands = buildAppCommands({ router });

      commands.forEach((cmd: CommandAction) => {
        expect(cmd.id).toBeDefined();
        expect(typeof cmd.id).toBe('string');
        expect(cmd.label).toBeDefined();
        expect(typeof cmd.label).toBe('string');
        expect(cmd.action).toBeDefined();
        expect(typeof cmd.action).toBe('function');
      });
    });

    it('should have proper command structure with optional fields', () => {
      const router = { push: vi.fn() };

      const commands = buildAppCommands({ router });

      commands.forEach((cmd: CommandAction) => {
        if (cmd.section) {
          expect(typeof cmd.section).toBe('string');
        }
        if (cmd.keywords) {
          expect(Array.isArray(cmd.keywords)).toBe(true);
        }
        if (cmd.shortcut) {
          expect(typeof cmd.shortcut).toBe('string');
        }
        if (cmd.icon) {
          expect(typeof cmd.icon).toBe('string');
        }
      });
    });

    it('should maintain unique command IDs', () => {
      const router = { push: vi.fn() };

      const commands = buildAppCommands({ router });
      const ids = commands.map((cmd) => cmd.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should support independent registry interface without hook integration', () => {
      const router = { push: vi.fn() };

      const commands = buildAppCommands({
        router,
        onNewOfframp: vi.fn(),
        onConnectWallet: vi.fn(),
        onOpenSettings: vi.fn(),
        onToggleTheme: vi.fn(),
        onOpenNotifications: vi.fn(),
      });

      expect(commands.length).toBeGreaterThan(0);

      const allCommandsAreValid = commands.every(
        (cmd) =>
          cmd.id &&
          cmd.label &&
          typeof cmd.action === 'function' &&
          (cmd.section === undefined || typeof cmd.section === 'string'),
      );

      expect(allCommandsAreValid).toBe(true);
    });
  });
});
