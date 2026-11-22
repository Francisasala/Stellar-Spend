import { z } from 'zod';

/**
 * Configuration schema for validation
 */

const EnvironmentSchema = z.enum(['development', 'staging', 'production']);

const ApiConfigSchema = z.object({
  maxDuration: z.number().positive().default(20),
  timeoutMs: z.number().positive().default(30000),
  retryAttempts: z.number().nonnegative().default(3),
  retryDelayMs: z.number().positive().default(1000),
});

const FeeConfigSchema = z.object({
  stablecoinFee: z.string().default('0.5'),
  bridgeFeePercentage: z.number().nonnegative().default(0.5),
  payoutFeePercentage: z.number().nonnegative().default(0),
});

const StellarConfigSchema = z.object({
  mainnetPassphrase: z.string().default('Public Global Stellar Network ; September 2015'),
  minXlmBalance: z.number().positive().default(2),
  reserveAmount: z.number().positive().default(0.5),
});

const BridgeConfigSchema = z.object({
  pollingIntervalMs: z.number().positive().default(2000),
  maxPollingAttempts: z.number().positive().default(150),
  timeoutMs: z.number().positive().default(300000),
});

const PayoutConfigSchema = z.object({
  pollingIntervalMs: z.number().positive().default(3000),
  maxPollingAttempts: z.number().positive().default(100),
  timeoutMs: z.number().positive().default(300000),
});

const TransactionConfigSchema = z.object({
  estimatedTimeSeconds: z.number().positive().default(300),
  confirmationBlocks: z.number().positive().default(1),
});

const RateLimitConfigSchema = z.object({
  requestsPerMinute: z.number().positive().default(60),
  requestsPerHour: z.number().positive().default(1000),
});

const CacheConfigSchema = z.object({
  currencyTtlMs: z.number().positive().default(3600000),
  rateTtlMs: z.number().positive().default(60000),
  institutionTtlMs: z.number().positive().default(86400000),
});

const ValidationConfigSchema = z.object({
  minAmount: z.string().default('0.01'),
  maxAmount: z.string().default('1000000'),
  amountDecimals: z.number().nonnegative().default(2),
});

export const ConfigSchema = z.object({
  environment: EnvironmentSchema.default('development'),
  api: ApiConfigSchema.default({}),
  fees: FeeConfigSchema.default({}),
  stellar: StellarConfigSchema.default({}),
  bridge: BridgeConfigSchema.default({}),
  payout: PayoutConfigSchema.default({}),
  transaction: TransactionConfigSchema.default({}),
  rateLimit: RateLimitConfigSchema.default({}),
  cache: CacheConfigSchema.default({}),
  validation: ValidationConfigSchema.default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export function validateConfig(config: unknown): Config {
  return ConfigSchema.parse(config);
}

/**
 * Environment variables the app cannot start without. Single source of truth
 * for env validation; `src/lib/env.ts` delegates here.
 */
export const requiredServerEnvKeys = [
  'PAYCREST_API_KEY',
  'PAYCREST_WEBHOOK_SECRET',
  'BASE_PRIVATE_KEY',
  'BASE_RETURN_ADDRESS',
  'BASE_RPC_URL',
  'STELLAR_SOROBAN_RPC_URL',
  'STELLAR_HORIZON_URL',
  'DATABASE_URL',
] as const;

export const requiredPublicEnvKeys = [
  'NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL',
  'NEXT_PUBLIC_BASE_RETURN_ADDRESS',
  'NEXT_PUBLIC_STELLAR_USDC_ISSUER',
] as const;

export const forbiddenPublicSecretKeys = [
  'NEXT_PUBLIC_PAYCREST_API_KEY',
  'NEXT_PUBLIC_BASE_PRIVATE_KEY',
] as const;

export type RequiredServerEnvKey = (typeof requiredServerEnvKeys)[number];
export type RequiredPublicEnvKey = (typeof requiredPublicEnvKeys)[number];

export type EnvSource = Record<string, string | undefined>;

export interface ValidatedEnv {
  server: Record<RequiredServerEnvKey, string>;
  public: Record<RequiredPublicEnvKey, string>;
}

function isMissing(value: string | undefined) {
  return !value || value.trim().length === 0;
}

export interface EnvValidationResult {
  missingServerKeys: RequiredServerEnvKey[];
  missingPublicKeys: RequiredPublicEnvKey[];
  forbiddenPublicKeys: (typeof forbiddenPublicSecretKeys)[number][];
}

/**
 * Collects every environment problem at once instead of failing on the first.
 */
export function collectEnvIssues(source: EnvSource = process.env): EnvValidationResult {
  return {
    missingServerKeys: requiredServerEnvKeys.filter((key) => isMissing(source[key])),
    missingPublicKeys: requiredPublicEnvKeys.filter((key) => isMissing(source[key])),
    forbiddenPublicKeys: forbiddenPublicSecretKeys.filter((key) => !isMissing(source[key])),
  };
}

function buildEnvErrorMessage(
  missingServerKeys: string[],
  missingPublicKeys: string[],
  forbiddenPublicKeys: string[],
) {
  const lines = [
    'Invalid environment configuration for Stellar-Spend.',
    'Create or update .env.local using .env.example before starting the server.',
  ];

  if (missingServerKeys.length > 0) {
    lines.push('');
    lines.push(`Missing required server env vars: ${missingServerKeys.join(', ')}`);
  }

  if (missingPublicKeys.length > 0) {
    lines.push('');
    lines.push(`Missing required public env vars: ${missingPublicKeys.join(', ')}`);
  }

  if (forbiddenPublicKeys.length > 0) {
    lines.push('');
    lines.push(`Remove secret values from public env vars: ${forbiddenPublicKeys.join(', ')}`);
    lines.push('PAYCREST_API_KEY and BASE_PRIVATE_KEY must never use the NEXT_PUBLIC_ prefix.');
  }

  return lines.join('\n');
}

/**
 * Validates required environment variables and fails fast with one error
 * listing every problem. Returns the typed values on success.
 */
export function loadEnvConfig(source: EnvSource = process.env): ValidatedEnv {
  const { missingServerKeys, missingPublicKeys, forbiddenPublicKeys } = collectEnvIssues(source);

  if (
    missingServerKeys.length > 0 ||
    missingPublicKeys.length > 0 ||
    forbiddenPublicKeys.length > 0
  ) {
    throw new Error(
      buildEnvErrorMessage(missingServerKeys, missingPublicKeys, forbiddenPublicKeys),
    );
  }

  return {
    server: Object.fromEntries(requiredServerEnvKeys.map((key) => [key, source[key]!])) as Record<
      RequiredServerEnvKey,
      string
    >,
    public: Object.fromEntries(requiredPublicEnvKeys.map((key) => [key, source[key]!])) as Record<
      RequiredPublicEnvKey,
      string
    >,
  };
}

/**
 * Startup entry helper: validates `process.env` and returns the typed env,
 * throwing a single aggregated error listing every missing/forbidden key.
 */
export function validateEnv(source: EnvSource = process.env): ValidatedEnv {
  return loadEnvConfig(source);
}
