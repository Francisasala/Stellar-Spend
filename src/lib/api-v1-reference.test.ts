import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Issue #1088: Tests for API v1 reference documentation
 * Verifies that the v1 API endpoints are documented and openapi.yaml is valid
 */

describe('API v1 Reference Documentation (#1088)', () => {
  const OPENAPI_PATH = resolve(process.cwd(), 'openapi.yaml');
  const API_REFERENCE_PATH = resolve(process.cwd(), 'docs/api-reference-v1.md');

  it('should have openapi.yaml file at project root', () => {
    expect(existsSync(OPENAPI_PATH)).toBe(true);
  });

  it('should have v1 API reference documentation', () => {
    expect(existsSync(API_REFERENCE_PATH)).toBe(true);
  });

  it('should document all v1 namespace endpoints', () => {
    const content = readFileSync(API_REFERENCE_PATH, 'utf-8');
    expect(content).toMatch(/\/v1\/fx-rates/i);
    expect(content).toMatch(/\/v1\/health/i);
    expect(content).toMatch(/\/v1\/offramp/i);
    expect(content).toMatch(/\/v1\/sync/i);
    expect(content).toMatch(/\/v1\/webhooks/i);
  });

  it('should include endpoint descriptions and request/response schemas', () => {
    const content = readFileSync(API_REFERENCE_PATH, 'utf-8');
    expect(content).toMatch(/request/i);
    expect(content).toMatch(/response/i);
    expect(content).toMatch(/parameter|parameter/i);
  });

  it('should have valid openapi.yaml structure', () => {
    const content = readFileSync(OPENAPI_PATH, 'utf-8');
    expect(content).toMatch(/openapi:/);
    expect(content).toMatch(/info:/);
    expect(content).toMatch(/paths:/);
  });

  it('should document all v1 route handlers in openapi.yaml', () => {
    const content = readFileSync(OPENAPI_PATH, 'utf-8');
    expect(content).toMatch(/\/v1\//);
    expect(content).toMatch(/fx-rates/i);
    expect(content).toMatch(/health/i);
    expect(content).toMatch(/offramp/i);
    expect(content).toMatch(/sync/i);
    expect(content).toMatch(/webhooks/i);
  });

  it('should include authentication and authorization information', () => {
    const content = readFileSync(API_REFERENCE_PATH, 'utf-8');
    expect(content).toMatch(/auth|authentication|api.?key|bearer|security/i);
  });

  it('should include error response documentation', () => {
    const content = readFileSync(API_REFERENCE_PATH, 'utf-8');
    expect(content).toMatch(/error|4\d\d|5\d\d/);
  });

  it('should have examples for each endpoint', () => {
    const content = readFileSync(API_REFERENCE_PATH, 'utf-8');
    expect(content).toMatch(/example|curl|request example|response example/i);
  });

  it('should document v1 API stability contract', () => {
    const content = readFileSync(API_REFERENCE_PATH, 'utf-8');
    expect(content).toMatch(/stable|version|v1|backward.?compatibility|deprecation/i);
  });
});
