/**
 * Quality Gate: ESLint Error-Handling Rules
 *
 * PURPOSE:
 *   Verifies that the two error-handling lint rules added in issue #1543 are
 *   present and set to "error" in eslint.config.js:
 *
 *   1. @typescript-eslint/no-floating-promises — prevents unawaited async
 *      calls that silently discard rejections.
 *   2. no-empty (allowEmptyCatch: false) — prevents empty catch blocks that
 *      swallow errors with no trace.
 *
 *   These checks guard against regression where someone accidentally removes
 *   or downgrades the rules.
 *
 * Related: eslint.config.js, Issue #1543
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const ESLINT_CONFIG_PATH = path.join(ROOT, 'eslint.config.js');

describe('Quality Gate — ESLint error-handling rules (#1543)', () => {
  let configSource: string;

  it('eslint.config.js exists', () => {
    expect(fs.existsSync(ESLINT_CONFIG_PATH)).toBe(true);
    configSource = fs.readFileSync(ESLINT_CONFIG_PATH, 'utf-8');
  });

  it('no-floating-promises rule is present and set to error', () => {
    configSource = configSource ?? fs.readFileSync(ESLINT_CONFIG_PATH, 'utf-8');
    expect(configSource).toContain('@typescript-eslint/no-floating-promises');
    // Must be set to 'error', not 'warn' or 'off'
    const match = configSource.match(
      /'@typescript-eslint\/no-floating-promises'\s*:\s*['"](\w+)['"]/
    );
    expect(match, 'no-floating-promises must have an explicit severity').toBeTruthy();
    expect(match![1]).toBe('error');
  });

  it('no-empty rule is present and disallows empty catch blocks', () => {
    configSource = configSource ?? fs.readFileSync(ESLINT_CONFIG_PATH, 'utf-8');
    expect(configSource).toContain('no-empty');
    expect(configSource).toContain('allowEmptyCatch: false');
  });

  it('no-empty is set to error severity', () => {
    configSource = configSource ?? fs.readFileSync(ESLINT_CONFIG_PATH, 'utf-8');
    // Match 'no-empty': ['error', ...] pattern
    const match = configSource.match(/'no-empty'\s*:\s*\[\s*['"](\w+)['"]/);
    expect(match, 'no-empty must use array form with explicit severity').toBeTruthy();
    expect(match![1]).toBe('error');
  });

  it('error-handling rules are documented with a comment', () => {
    configSource = configSource ?? fs.readFileSync(ESLINT_CONFIG_PATH, 'utf-8');
    expect(configSource).toContain('Error-handling lint rules');
  });
});
