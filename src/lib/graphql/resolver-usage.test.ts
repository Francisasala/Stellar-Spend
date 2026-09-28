import { describe, it, expect, beforeEach } from 'vitest';
import {
  withUsageTracking,
  getResolverUsageReport,
  getUnusedResolvers,
  resetResolverUsage,
} from './resolver-usage';

describe('resolver-usage', () => {
  beforeEach(() => {
    resetResolverUsage();
  });

  it('registers every field at zero calls before invocation', () => {
    withUsageTracking('Query', {
      foo: () => 'foo',
      bar: () => 'bar',
    });
    const unused = getUnusedResolvers();
    expect(unused.map((r) => r.fieldName).sort()).toEqual(['bar', 'foo']);
  });

  it('increments call count and updates lastCalledAt on invocation', () => {
    const wrapped = withUsageTracking('Query', { foo: () => 'foo' });
    wrapped.foo();
    wrapped.foo();
    const report = getResolverUsageReport();
    const fooRecord = report.find((r) => r.fieldName === 'foo');
    expect(fooRecord?.callCount).toBe(2);
    expect(fooRecord?.lastCalledAt).not.toBeNull();
  });

  it('excludes called fields from getUnusedResolvers', () => {
    const wrapped = withUsageTracking('Mutation', { used: () => null, neverCalled: () => null });
    wrapped.used();
    const unused = getUnusedResolvers().map((r) => r.fieldName);
    expect(unused).toContain('neverCalled');
    expect(unused).not.toContain('used');
  });

  it('preserves the original return value', () => {
    const wrapped = withUsageTracking('Query', { echo: (x: unknown) => x });
    expect(wrapped.echo('hello')).toBe('hello');
  });
});
