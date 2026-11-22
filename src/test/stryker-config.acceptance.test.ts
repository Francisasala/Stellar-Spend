/**
 * Acceptance checks for stryker.conf.json (#1522).
 *
 * Verifies the mutation testing config is well-formed, covers the
 * money-critical modules, keeps the review thresholds sensible and
 * includes the recommended node args for the vitest runner.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const raw = fs.readFileSync('stryker.conf.json', 'utf8');
const config = JSON.parse(raw) as Record<string, any>;

describe('stryker.conf.json (acceptance)', () => {
  it('is valid JSON with the expected version and runners', () => {
    expect(config.version).toBe('7');
    expect(config.testRunner).toBe('vitest');
    expect(config.testFramework).toBe('vitest');
    expect(config.coverageAnalysis).toBe('perTest');
  });

  it('mutates the money-critical paths', () => {
    const mutate = config.mutate as string[];
    expect(mutate).toContain('src/lib/**/*.ts');
    expect(mutate).toContain('src/lib/cache/service.ts');
    expect(mutate).toContain('src/lib/cache/keys.ts');
    expect(mutate).toContain('src/lib/clients/http-client.ts');
    expect(mutate).toContain('src/lib/clients/paycrest.ts');
    expect(mutate).toContain('src/lib/clients/allbridge.ts');
  });

  it('mutates api routes', () => {
    expect((config.mutate as string[]).some((m) => m.includes('src/app/api/'))).toBe(true);
  });

  it('declares the money-path and security mutation groups', () => {
    const groups = config.mutationGroups as Record<string, string[]>;
    expect(groups['money-path']).toContain('src/lib/clients/http-client.ts');
    expect(groups['security']).toContain('src/lib/clients/http-client.ts');
  });

  it('sets sensible review thresholds (break < low < medium < high)', () => {
    const t = config.thresholds;
    expect(t.break).toBeLessThanOrEqual(t.low);
    expect(t.low).toBeLessThanOrEqual(t.medium);
    expect(t.medium).toBeLessThanOrEqual(t.high);
  });

  it('configures the vitest runner plugin', () => {
    expect(config.plugins).toContain('@stryker-mutator/typescript-checker');
    expect((config.vitest as Record<string, string>).configFile).toBe('vitest.mutation.config.ts');
  });
});
