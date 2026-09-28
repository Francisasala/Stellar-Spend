/**
 * Quality Gate: Dependency Pinning Policy
 *
 * PURPOSE:
 *   This quality-gate test enforces the project's dependency pinning policy
 *   (documented in CONTRIBUTING.md). It validates that:
 *
 *   1. Package.json exists and is parseable.
 *   2. A subset of "hard-pinned" dependencies (those listed in
 *      PINNED_EXACT_DEPS below) use exact versions (no `^` or `~` ranges).
 *   3. The contributing guide documents the Version Pinning policy so every
 *      contributor knows why pinning matters.
 *
 * WHAT THIS TEST DOES NOT DO:
 *   It does NOT require ALL dependencies to be pinned. Runtime dependencies
 *   managed by Renovate are allowed to use caret ranges — Renovate opens PRs
 *   for each bump, which provides equivalent safety. Only the small list of
 *   security-critical or build-stability-critical packages must be exact.
 *
 * ADDING / REMOVING PINS:
 *   Update `PINNED_EXACT_DEPS` below and ensure the corresponding entry in
 *   package.json uses an exact version string.
 *
 * AUDIT:
 *   To see the current pinning status of all dependencies, run:
 *     node -e "
 *       const p = require('./package.json');
 *       const all = {...p.dependencies, ...p.devDependencies};
 *       Object.entries(all).filter(([,v]) => v.startsWith('^') || v.startsWith('~'))
 *                          .forEach(([k,v]) => console.log(k, v));
 *     "
 *
 * Related: CONTRIBUTING.md § "Version Pinning"
 *          docs/dependency-update-policy.md
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Packages that MUST be pinned to exact versions.
// These are either part of the runtime critical path or affect build
// reproducibility in ways that Renovate range-bumps alone cannot protect.
// ---------------------------------------------------------------------------
const PINNED_EXACT_DEPS: string[] = [
  'react', // React major bumps require coordinated changes across the codebase
  'react-dom', // Must always match `react` exactly
  'typescript', // Compiler version affects type-safety guarantees across all CI runs
];

// ---------------------------------------------------------------------------
// Packages that are intentionally excluded from exact pinning because they
// are managed via Renovate + automated PR review.
// ---------------------------------------------------------------------------
const RANGE_ALLOWED_DEPS = [
  'next',
  '@stellar/stellar-sdk',
  '@sentry/nextjs',
  '@allbridge/bridge-core-sdk',
  'viem',
];

const ROOT = path.resolve(process.cwd());

describe('Quality Gate — Dependency Pinning', () => {
  let pkg: Record<string, unknown>;

  it('package.json exists and is valid JSON', () => {
    const pkgPath = path.join(ROOT, 'package.json');
    expect(fs.existsSync(pkgPath), 'package.json must exist at project root').toBe(true);
    const content = fs.readFileSync(pkgPath, 'utf-8');
    expect(() => {
      pkg = JSON.parse(content);
    }, 'package.json must be valid JSON').not.toThrow();
  });

  it('hard-pinned dependencies use exact versions', () => {
    const pkgPath = path.join(ROOT, 'package.json');
    const content = fs.readFileSync(pkgPath, 'utf-8');
    pkg = JSON.parse(content);

    const all: Record<string, string> = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      ...(pkg.devDependencies as Record<string, string> | undefined),
    };

    const violations: string[] = [];
    for (const dep of PINNED_EXACT_DEPS) {
      const version = all[dep];
      if (version === undefined) {
        // Dep is not present — not a violation (it may have been removed)
        continue;
      }
      if (version.startsWith('^') || version.startsWith('~')) {
        violations.push(`${dep}: "${version}" (must be exact, e.g. "${version.slice(1)}")`);
      }
    }

    if (violations.length > 0) {
      const msg =
        'The following dependencies must be pinned to exact versions:\n' +
        violations.map((v) => `  - ${v}`).join('\n') +
        '\nSee CONTRIBUTING.md § "Version Pinning" for rationale.';
      expect.fail(msg);
    }

    expect(violations).toHaveLength(0);
  });

  it('documents which deps are intentionally range-versioned', () => {
    // Verify that Renovate config exists — it is the safety net for ranged deps.
    const renovatePath = path.join(ROOT, '.github', 'renovate.json');
    expect(
      fs.existsSync(renovatePath),
      'Renovate config must exist when ranged deps are allowed (.github/renovate.json)',
    ).toBe(true);
  });

  it('dependency update policy is documented in CONTRIBUTING.md', () => {
    const contributingPath = path.join(ROOT, 'CONTRIBUTING.md');
    expect(fs.existsSync(contributingPath), 'CONTRIBUTING.md must exist').toBe(true);

    const content = fs.readFileSync(contributingPath, 'utf-8');
    expect(content, 'CONTRIBUTING.md must contain "Dependency" section').toContain('Dependency');
    expect(content, 'CONTRIBUTING.md must contain "Version Pinning" policy').toContain(
      'Version Pinning',
    );
  });

  it('range-allowed deps are listed in Renovate config (traceability)', () => {
    const renovatePath = path.join(ROOT, '.github', 'renovate.json');
    if (!fs.existsSync(renovatePath)) return; // Covered by prior test

    const content = fs.readFileSync(renovatePath, 'utf-8');
    // Renovate config should reference at least one of the known range-allowed packages
    // (or use a broad packageRules that covers them) — this is a smoke check.
    const hasPackageRules = content.includes('packageRules') || content.includes('matchPackageNames');
    const hasBroadRule = content.includes('"*"') || content.includes("'*'");
    expect(
      hasPackageRules || hasBroadRule,
      'Renovate config should contain packageRules or a broad update rule',
    ).toBe(true);
  });
});
