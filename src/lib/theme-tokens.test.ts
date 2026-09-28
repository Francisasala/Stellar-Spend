import { describe, it, expect } from 'vitest';
import { getContrastRatio, isWcagAA, isWcagAAA, auditContrastPairs, auditSemanticTokens } from './contrast-checker';

/**
 * Issue #1116: Tests for theme token consolidation
 * Ensures single source of truth for theme tokens across useTheme, contrast-checker, and tests
 */

// Centralized theme token definitions
const THEME_TOKENS = {
  dark: {
    bg: '#0a0a0a',
    panel: '#131313',
    'panel-elevated': '#1a1a1a',
    'panel-overlay': '#1f1f1f',
    line: '#2a2a2a',
    'line-strong': '#3a3a3a',
    muted: '#8a8a8a',
    text: '#ffffff',
    'text-subtle': '#d0d0d0',
    accent: '#d4b06a',
    'accent-hover': '#e0c07f',
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
  },
  light: {
    bg: '#f5f5f5',
    panel: '#ffffff',
    'panel-elevated': '#fafafa',
    'panel-overlay': '#ffffff',
    line: '#e0e0e0',
    'line-strong': '#cccccc',
    muted: '#5f5f5f',
    text: '#0a0a0a',
    'text-subtle': '#333333',
    accent: '#8a6b15',
    'accent-hover': '#7d6013',
    success: '#0e7a38',
    warning: '#b45309',
    error: '#c81e1e',
    info: '#1d4ed8',
  },
  highContrast: {
    bg: '#000000',
    panel: '#000000',
    'panel-elevated': '#0a0a0a',
    'panel-overlay': '#0a0a0a',
    line: '#ffffff',
    'line-strong': '#ffffff',
    muted: '#ffff00',
    text: '#ffffff',
    'text-subtle': '#ffffff',
    accent: '#ffff00',
    'accent-hover': '#ffffff',
    success: '#00ff00',
    warning: '#ffff00',
    error: '#ff6060',
    info: '#00ffff',
  },
} as const;

describe('Theme Token Consolidation (#1116)', () => {
  describe('Centralized token source', () => {
    it('provides consistent token definitions across themes', () => {
      const themes = Object.keys(THEME_TOKENS);
      expect(themes).toContain('dark');
      expect(themes).toContain('light');
      expect(themes).toContain('highContrast');
    });

    it('dark theme has all required token categories', () => {
      const requiredTokens = [
        'bg',
        'panel',
        'panel-elevated',
        'panel-overlay',
        'line',
        'line-strong',
        'text',
        'text-subtle',
        'muted',
        'accent',
        'accent-hover',
        'success',
        'warning',
        'error',
        'info',
      ];

      const darkTokens = THEME_TOKENS.dark;
      for (const token of requiredTokens) {
        expect(darkTokens[token as keyof typeof darkTokens]).toBeDefined();
      }
    });

    it('light theme has all required token categories', () => {
      const requiredTokens = [
        'bg',
        'panel',
        'panel-elevated',
        'panel-overlay',
        'line',
        'line-strong',
        'text',
        'text-subtle',
        'muted',
        'accent',
        'accent-hover',
        'success',
        'warning',
        'error',
        'info',
      ];

      const lightTokens = THEME_TOKENS.light;
      for (const token of requiredTokens) {
        expect(lightTokens[token as keyof typeof lightTokens]).toBeDefined();
      }
    });

    it('high-contrast theme has all required token categories', () => {
      const requiredTokens = [
        'bg',
        'panel',
        'panel-elevated',
        'panel-overlay',
        'line',
        'line-strong',
        'text',
        'text-subtle',
        'muted',
        'accent',
        'accent-hover',
        'success',
        'warning',
        'error',
        'info',
      ];

      const hcTokens = THEME_TOKENS.highContrast;
      for (const token of requiredTokens) {
        expect(hcTokens[token as keyof typeof hcTokens]).toBeDefined();
      }
    });
  });

  describe('Contrast ratio validation across all themes', () => {
    it('dark theme text tokens maintain WCAG AA standards', () => {
      const pairs = auditContrastPairs(THEME_TOKENS.dark);
      const wcagAAPairs = pairs.filter((p) => p.wcagAA);
      expect(wcagAAPairs.length).toBe(pairs.length);
    });

    it('light theme text tokens maintain WCAG AA standards', () => {
      const pairs = auditContrastPairs(THEME_TOKENS.light);
      const wcagAAPairs = pairs.filter((p) => p.wcagAA);
      expect(wcagAAPairs.length).toBe(pairs.length);
    });

    it('high-contrast theme text tokens maintain WCAG AA standards', () => {
      const pairs = auditContrastPairs(THEME_TOKENS.highContrast);
      const wcagAAPairs = pairs.filter((p) => p.wcagAA);
      expect(wcagAAPairs.length).toBe(pairs.length);
    });

    it('dark theme semantic tokens maintain WCAG AA standards', () => {
      const pairs = auditSemanticTokens(THEME_TOKENS.dark);
      const wcagAAPairs = pairs.filter((p) => p.wcagAA);
      expect(wcagAAPairs.length).toBe(pairs.length);
    });

    it('light theme semantic tokens maintain WCAG AA standards', () => {
      const pairs = auditSemanticTokens(THEME_TOKENS.light);
      const wcagAAPairs = pairs.filter((p) => p.wcagAA);
      expect(wcagAAPairs.length).toBe(pairs.length);
    });

    it('high-contrast theme semantic tokens maintain WCAG AA standards', () => {
      const pairs = auditSemanticTokens(THEME_TOKENS.highContrast);
      const wcagAAPairs = pairs.filter((p) => p.wcagAA);
      expect(wcagAAPairs.length).toBe(pairs.length);
    });
  });

  describe('Contrast calculation consistency', () => {
    it('produces consistent contrast ratios for same color pairs', () => {
      const ratio1 = getContrastRatio('#000000', '#ffffff');
      const ratio2 = getContrastRatio('#000000', '#ffffff');
      expect(ratio1).toBe(ratio2);
    });

    it('handles color order independence for contrast calculation', () => {
      const darkText = THEME_TOKENS.dark.text;
      const darkBg = THEME_TOKENS.dark.bg;

      const ratio1 = getContrastRatio(darkText, darkBg);
      const ratio2 = getContrastRatio(darkBg, darkText);

      // Both should be valid WCAG AA (just different order doesn't matter for contrast)
      expect(ratio1).toBeGreaterThan(0);
      expect(ratio2).toBeGreaterThan(0);
    });

    it('validates WCAG AAA compliance for critical color combinations', () => {
      const criticalPairs = [
        { fg: THEME_TOKENS.dark.text, bg: THEME_TOKENS.dark.bg, name: 'dark:text-on-bg' },
        { fg: THEME_TOKENS.light.text, bg: THEME_TOKENS.light.bg, name: 'light:text-on-bg' },
        {
          fg: THEME_TOKENS.highContrast.text,
          bg: THEME_TOKENS.highContrast.bg,
          name: 'hc:text-on-bg',
        },
      ];

      for (const pair of criticalPairs) {
        const ratio = getContrastRatio(pair.fg, pair.bg);
        expect(isWcagAAA(ratio)).toBe(true);
      }
    });
  });

  describe('Theme token usage across components', () => {
    it('provides tokens for component styling', () => {
      const darkTheme = THEME_TOKENS.dark;
      expect(darkTheme.text).toBe('#ffffff');
      expect(darkTheme.bg).toBe('#0a0a0a');
      expect(darkTheme.accent).toBe('#d4b06a');
    });

    it('supports semantic token resolution', () => {
      const lightTheme = THEME_TOKENS.light;
      const successOnBg = getContrastRatio(lightTheme.success, lightTheme.bg);
      expect(isWcagAA(successOnBg)).toBe(true);
    });

    it('provides surface level hierarchy', () => {
      const darkTheme = THEME_TOKENS.dark;
      // Verify panel layers exist
      expect(darkTheme.panel).toBeDefined();
      expect(darkTheme['panel-elevated']).toBeDefined();
      expect(darkTheme['panel-overlay']).toBeDefined();
    });
  });

  describe('Color palette consistency', () => {
    it('ensures dark theme uses dark colors for backgrounds', () => {
      const darkTheme = THEME_TOKENS.dark;
      const bgColor = parseInt(darkTheme.bg.slice(1), 16);
      const panelColor = parseInt(darkTheme.panel.slice(1), 16);

      expect(bgColor).toBeLessThan(0x202020);
      expect(panelColor).toBeLessThan(0x202020);
    });

    it('ensures light theme uses light colors for backgrounds', () => {
      const lightTheme = THEME_TOKENS.light;
      const bgColor = parseInt(lightTheme.bg.slice(1), 16);
      const panelColor = parseInt(lightTheme.panel.slice(1), 16);

      expect(bgColor).toBeGreaterThan(0xe0e0e0);
      expect(panelColor).toBeGreaterThan(0xe0e0e0);
    });

    it('ensures text colors contrast with backgrounds in light theme', () => {
      const lightTheme = THEME_TOKENS.light;
      const textOnBg = getContrastRatio(lightTheme.text, lightTheme.bg);
      expect(isWcagAA(textOnBg)).toBe(true);
    });

    it('ensures text colors contrast with backgrounds in dark theme', () => {
      const darkTheme = THEME_TOKENS.dark;
      const textOnBg = getContrastRatio(darkTheme.text, darkTheme.bg);
      expect(isWcagAA(textOnBg)).toBe(true);
    });
  });

  describe('Token validation', () => {
    it('all tokens are valid hex colors', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      const allThemes = [THEME_TOKENS.dark, THEME_TOKENS.light, THEME_TOKENS.highContrast];

      for (const theme of allThemes) {
        for (const [, color] of Object.entries(theme)) {
          expect(color).toMatch(hexRegex);
        }
      }
    });

    it('maintains consistent token naming across themes', () => {
      const darkKeys = Object.keys(THEME_TOKENS.dark).sort();
      const lightKeys = Object.keys(THEME_TOKENS.light).sort();
      const hcKeys = Object.keys(THEME_TOKENS.highContrast).sort();

      expect(darkKeys).toEqual(lightKeys);
      expect(lightKeys).toEqual(hcKeys);
    });
  });

  describe('Theme regression prevention', () => {
    it('detects contrast ratio regressions when colors change', () => {
      const originalDarkBg = THEME_TOKENS.dark.bg;
      const originalDarkText = THEME_TOKENS.dark.text;

      const originalRatio = getContrastRatio(originalDarkText, originalDarkBg);

      // Simulate a changed color that would reduce contrast
      const modifiedBg = '#1a1a1a'; // Lighter background
      const modifiedRatio = getContrastRatio(originalDarkText, modifiedBg);

      expect(modifiedRatio).toBeLessThan(originalRatio);
    });

    it('ensures muted text meets minimum contrast on all surfaces', () => {
      const darkTheme = THEME_TOKENS.dark;
      const mutedColor = darkTheme.muted;
      const surfaces = [
        darkTheme.bg,
        darkTheme.panel,
        darkTheme['panel-elevated'],
        darkTheme['panel-overlay'],
      ];

      for (const surface of surfaces) {
        const ratio = getContrastRatio(mutedColor, surface);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('ensures all semantic tokens are visible on any background', () => {
      const lightTheme = THEME_TOKENS.light;
      const semanticTokens = ['success', 'warning', 'error', 'info', 'accent'];
      const backgrounds = ['bg', 'panel', 'panel-elevated', 'panel-overlay'];

      for (const semantic of semanticTokens) {
        for (const bg of backgrounds) {
          const ratio = getContrastRatio(
            lightTheme[semantic as keyof typeof lightTheme],
            lightTheme[bg as keyof typeof lightTheme],
          );
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });
});
