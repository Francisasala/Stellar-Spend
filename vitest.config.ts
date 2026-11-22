import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@stellar-spend/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
    },
  },
  test: {
    env: {
      PAYCREST_API_KEY: 'test-key',
      PAYCREST_WEBHOOK_SECRET: 'test-secret',
      BASE_PRIVATE_KEY: '0x0000000000000000000000000000000000000000000000000000000000000000',
      BASE_RETURN_ADDRESS: '0x0000000000000000000000000000000000000000',
      BASE_RPC_URL: 'https://sepolia.base.org',
      STELLAR_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
      NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      NEXT_PUBLIC_BASE_RETURN_ADDRESS: '0x0000000000000000000000000000000000000000',
      NEXT_PUBLIC_STELLAR_USDC_ISSUER: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ75XABZEYYWRB6HP',
      DATABASE_URL: 'postgresql://localhost:5432/stellar_test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      all: true,
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
        perFile: true,
        autoUpdate: false,
      },
      perFile: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
      thresholdsForFile: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
        // Shared validation helpers extracted from form components
        'src/lib/validation/**': {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
        // Notification state reducer/context
        'src/components/NotificationCenter*': {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
        'src/lib/notifications/**': {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
        // Unified error boundary
        'src/components/ErrorBoundary*': {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
        // Higher thresholds for security-critical modules
        'src/lib/offramp/**': {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
        'src/lib/onramp/**': {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
        'src/lib/auth/**': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        'src/app/api/**': {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
        // Shared components (offline handling, i18n, constants) must stay well covered
        // Contexts, hooks and components touched by the a11y/context refactors
        'src/contexts/**': {
          lines: 85,
          functions: 85,
          branches: 85,
          statements: 85,
        },
        'src/hooks/**': {
          lines: 85,
          functions: 85,
          branches: 85,
          statements: 85,
        },
        'src/components/**': {
          lines: 85,
          functions: 85,
          branches: 85,
          statements: 85,
        },
        // Single online-status hook used by OfflineBanner
        'src/hooks/useOnlineStatus*': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        // i18n message catalogs and helpers
        'src/i18n/**': {
          lines: 85,
          functions: 85,
          branches: 85,
          statements: 85,
        },
      },
      exclude: [
        '**/node_modules/**',
        '**/e2e/**',
        '**/*.stories.*',
        '**/src/stories/**',
        '**/.storybook/**',
        '.next/**',
        '**/src/test/setup.ts',
        '**/src/test/mocks/**',
        '**/src/test/fixtures/**',
        '**/src/test/factories/**',
        '**/src/test/test-helpers.ts',
        '**/tests/**',
        '**/src/test/__snapshots__/**',
        '**/src/test/snapshots/**',
        // Documentation/spec acceptance tests validate static files only; they
        // contain no executable application logic and are excluded from coverage.
        '**/src/test/openapi-spec.test.ts',
        '**/src/test/docs-acceptance.test.ts',
      ],
    },
    projects: [
      {
        extends: true,
        name: 'unit',
        test: {
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./src/test/setup.ts'],
          include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            'tests/**/*.{test,spec}.{ts,tsx}',
            'packages/**/*.{test,spec}.{ts,tsx}',
            '__tests__/**/*.{test,spec}.{ts,tsx}',
          ],
          exclude: ['**/node_modules/**', '**/e2e/**', '**/*.stories.*'],
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          // Pick up story files (including interaction tests) for shared components
          include: ['src/**/*.stories.{ts,tsx}'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
  },
});
