/**
 * Environment variable type declarations
 * This helps with TypeScript intellisense and type checking
 *
 * NOTE: These typings mirror the centralized schema in `src/lib/env.ts`.
 * Required variables are typed as `string`; optional variables are typed as
 * `string | undefined`. Keep this file in sync with the schema.
 */

declare namespace NodeJS {
  interface ProcessEnv {
    // Server-side only variables (required)
    PAYCREST_API_KEY: string;
    PAYCREST_WEBHOOK_SECRET: string;
    BASE_PRIVATE_KEY: string;
    BASE_RETURN_ADDRESS: string;
    BASE_RPC_URL: string;
    STELLAR_SOROBAN_RPC_URL: string;
    STELLAR_HORIZON_URL: string;

    // Server-side only variables (optional)
    DATABASE_URL: string | undefined;

    // Database pool configuration (optional)
    DB_POOL_SIZE: string | undefined;
    DB_POOL_MIN: string | undefined;
    DB_IDLE_TIMEOUT: string | undefined;
    DB_CONNECTION_TIMEOUT: string | undefined;
    DB_STATEMENT_TIMEOUT: string | undefined;

    // Logging (optional)
    LOG_LEVEL: string | undefined;

    // Public variables (available in browser)
    NEXT_PUBLIC_BASE_RETURN_ADDRESS: string;
    NEXT_PUBLIC_STELLAR_USDC_ISSUER: string;
    NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL: string | undefined;
  }
}
