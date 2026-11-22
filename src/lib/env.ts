import { loadEnvConfig, type ValidatedEnv } from './config/schema';

/**
 * Centralized environment configuration entry point.
 *
 * All environment validation rules live in `config/schema.ts`. This module is
 * the single place that binds those rules to `process.env` and is responsible
 * for validating the environment eagerly at startup so that misconfiguration
 * fails fast (with the aggregated error produced by the schema loader) rather
 * than surfacing later at an arbitrary point in the application.
 */

/**
 * Validate `process.env` against the schema and return the typed environment.
 *
 * Throws an aggregated error (from `config/schema.ts`) listing every problem
 * found, so callers get a complete picture of what is misconfigured instead of
 * only the first failure.
 */
export function validateEnv(): ValidatedEnv {
  return loadEnvConfig(process.env);
}

/**
 * Test-environment bypass.
 *
 * Under Vitest we deliberately skip eager validation so that unit tests can
 * import modules that depend on `env` without having to provide a complete,
 * valid environment. Tests that exercise validation itself should call
 * `validateEnv()` directly (or stub `process.env`) rather than relying on the
 * eagerly-evaluated `env` export.
 */
const isTestEnv = Boolean(process.env.VITEST);

/**
 * The validated, typed environment.
 *
 * In production/development this is the result of eager validation at module
 * load time (fail fast). In the test environment it is an empty placeholder
 * cast to `ValidatedEnv`; see the bypass note above.
 */
export const env: ValidatedEnv = isTestEnv ? ({} as ValidatedEnv) : validateEnv();
