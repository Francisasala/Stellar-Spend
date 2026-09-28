/**
 * Vitest configuration for mutation testing — pilot scope: src/lib
 *
 * This config is used by Stryker via `stryker.conf.json` when running
 * mutation tests. It intentionally:
 *
 *  1. Restricts the test environment to jsdom (matching the unit test suite)
 *  2. Excludes E2E tests (`e2e/`) which Stryker cannot drive
 *  3. Sets up the same aliases and environment variables as the regular suite
 *
 * PILOT SCOPE:
 *   The mutation pilot targets `src/lib/**` (see `mutate` in stryker.conf.json).
 *   This is the core business-logic layer, which has the best unit coverage
 *   and the highest value for mutation testing. Once the pilot score is stable
 *   above the `break` threshold (55%), coverage can be extended to `src/app/api`.
 *
 * RUNNING LOCALLY:
 *   See docs/mutation-testing.md for full instructions. Quick reference:
 *
 *     # Full mutation run (all files in mutate glob)
 *     npm run test:mutation
 *
 *     # Pilot scope only (src/lib — faster, recommended for local dev)
 *     npx stryker run --mutate "src/lib/**\/*.ts,!src/lib/**\/*.test.ts"
 *
 *     # Single file (fastest feedback loop)
 *     npx stryker run --mutate "src/lib/fee-calculation.ts"
 *
 *     # View the HTML report after a run
 *     open mutation-report/index.html   # macOS
 *     xdg-open mutation-report/index.html  # Linux
 *
 * THRESHOLDS (defined in stryker.conf.json):
 *   break  55  — CI fails below this; do not merge
 *   low    60  — reported as warning
 *   medium 70  — reported as warning
 *   high   80  — target for green score badge
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom matches the browser-like environment used by src/lib utilities
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Exclude E2E tests — Stryker cannot run Playwright specs
    exclude: ['**/node_modules/**', '**/e2e/**'],
    // Only include src/lib and src/app/api for mutation pilot
    // (this is a hint to Vitest; Stryker's `mutate` glob is the authoritative filter)
    include: ['src/lib/**/*.test.ts', 'src/lib/**/*.test.tsx', 'src/app/api/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.test.ts', '**/*.test.tsx'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
