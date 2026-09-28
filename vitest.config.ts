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
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
        perFile: false,
      },
      exclude: [
        '**/node_modules/**',
        '**/e2e/**',
        '**/*.stories.*',
        '**/src/stories/**',
        '.next/**',
        '**/src/test/setup.ts',
        '**/src/test/mocks/**',
        '**/src/test/fixtures/**',
        '**/src/test/factories/**',
        '**/src/test/test-helpers.ts',
        '**/__tests__/**',
        '**/tests/**',
        '**/src/test/__snapshots__/**',
        '**/src/test/snapshots/**',
      ],
    },
    projects: [{
      extends: true,
      name: 'unit',
      test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        exclude: ['**/node_modules/**', '**/e2e/**']
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});
