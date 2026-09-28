/**
 * #1041 — Theme contrast regression test
 *
 * Asserts WCAG AA (≥ 4.5:1) for every meaningful foreground/background
 * token combination across all three themes: dark, light, and high-contrast.
 *
 * Adding a new token or tweaking a colour value that drops below 4.5:1 will
 * cause this test to fail, making contrast regressions visible in CI.
 */

import { describe, it, expect } from 'vitest';
import {
  getContrastRatio,
  isWcagAA,
  auditContrastPairs,
  auditSemanticTokens,
  type ContrastPair,
} from './contrast-checker';

// ---------------------------------------------------------------------------
// Token snapshots — keep in sync with src/app/globals.css
// ---------------------------------------------------------------------------

const DARK_TOKENS: Record<string, string> = {
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
};

const LIGHT_TOKENS: Record<string, string> = {
  bg: '#f5f5f5',
  panel: '#ffffff',
  'panel-elevated': '#fafafa',
  'panel-overlay': '#ffffff',
  line: '#e0e0e0',
  'line-strong': '#cccccc',
  muted: '#5f5f5f',
  text: '#0a0a0a',
  'text-subtle': '#333333',
  // Fixed in #1041 — see globals.css
  accent: '#8a6b15',
  'accent-hover': '#7d6013',
  success: '#0e7a38',
  warning: '#b45309',
  error: '#c81e1e',
  info: '#1d4ed8',
};

const HIGH_CONTRAST_TOKENS: Record<string, string> = {
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
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function failingPairs(pairs: ContrastPair[]): ContrastPair[] {
  return pairs.filter((p) => !p.wcagAA);
}

function formatFailures(pairs: ContrastPair[]): string {
  return pairs
    .map((p) => `  ${p.foregroundName}(${p.foreground}) on ${p.backgroundName}(${p.background}): ${p.contrast}:1`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Unit tests — getContrastRatio / helpers
// ---------------------------------------------------------------------------

describe('contrast-checker utilities', () => {
  it('reports 21:1 for pure black on white', () => {
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('reports 1:1 for identical colours', () => {
    expect(getContrastRatio('#888888', '#888888')).toBeCloseTo(1, 1);
  });

  it('isWcagAA passes at exactly 4.5', () => {
    expect(isWcagAA(4.5)).toBe(true);
  });

  it('isWcagAA fails below 4.5', () => {
    expect(isWcagAA(4.49)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Regression — all themes must pass WCAG AA for text + semantic tokens
// ---------------------------------------------------------------------------

describe('#1041 dark-mode contrast regression', () => {
  describe('dark theme — text tokens on surfaces', () => {
    const pairs = auditContrastPairs(DARK_TOKENS);
    const failures = failingPairs(pairs);

    it('all text/muted tokens pass WCAG AA on every surface', () => {
      expect(failures, `Failing pairs:\n${formatFailures(failures)}`).toHaveLength(0);
    });

    // Spot-check the lowest contrast pair (muted on panel-overlay is the tightest)
    it('muted on panel-overlay is at least 4.5:1', () => {
      const pair = pairs.find(
        (p) => p.foregroundName === 'muted' && p.backgroundName === 'panel-overlay',
      );
      expect(pair).toBeDefined();
      expect(pair!.contrast).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('dark theme — semantic tokens on surfaces', () => {
    const pairs = auditSemanticTokens(DARK_TOKENS);
    const failures = failingPairs(pairs);

    it('all semantic tokens pass WCAG AA on every surface', () => {
      expect(failures, `Failing pairs:\n${formatFailures(failures)}`).toHaveLength(0);
    });
  });
});

describe('#1041 light-mode contrast regression', () => {
  describe('light theme — text tokens on surfaces', () => {
    const pairs = auditContrastPairs(LIGHT_TOKENS);
    const failures = failingPairs(pairs);

    it('all text/muted tokens pass WCAG AA on every surface', () => {
      expect(failures, `Failing pairs:\n${formatFailures(failures)}`).toHaveLength(0);
    });
  });

  describe('light theme — semantic tokens on surfaces', () => {
    const pairs = auditSemanticTokens(LIGHT_TOKENS);
    const failures = failingPairs(pairs);

    it('all semantic tokens (success, error, accent, warning, info) pass WCAG AA', () => {
      expect(failures, `Failing pairs:\n${formatFailures(failures)}`).toHaveLength(0);
    });

    // Individual pin-tests for the tokens we fixed in #1041
    it('success (#0e7a38) passes 4.5:1 on lightest background (#f5f5f5)', () => {
      const ratio = getContrastRatio(LIGHT_TOKENS.success!, LIGHT_TOKENS.bg!);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('error (#c81e1e) passes 4.5:1 on lightest background (#f5f5f5)', () => {
      const ratio = getContrastRatio(LIGHT_TOKENS.error!, LIGHT_TOKENS.bg!);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('accent (#8a6b15) passes 4.5:1 on lightest background (#f5f5f5)', () => {
      const ratio = getContrastRatio(LIGHT_TOKENS.accent!, LIGHT_TOKENS.bg!);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('accent-hover (#7d6013) passes 4.5:1 on lightest background (#f5f5f5)', () => {
      const ratio = getContrastRatio(LIGHT_TOKENS['accent-hover']!, LIGHT_TOKENS.bg!);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe('#1041 high-contrast theme regression', () => {
  describe('high-contrast theme — text tokens on surfaces', () => {
    const pairs = auditContrastPairs(HIGH_CONTRAST_TOKENS);
    const failures = failingPairs(pairs);

    it('all text/muted tokens pass WCAG AA on every surface', () => {
      expect(failures, `Failing pairs:\n${formatFailures(failures)}`).toHaveLength(0);
    });
  });

  describe('high-contrast theme — semantic tokens on surfaces', () => {
    const pairs = auditSemanticTokens(HIGH_CONTRAST_TOKENS);
    const failures = failingPairs(pairs);

    it('all semantic tokens pass WCAG AA on every surface', () => {
      expect(failures, `Failing pairs:\n${formatFailures(failures)}`).toHaveLength(0);
    });
  });
});
