import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Issue #1089: Tests for offramp settlement flow ADR documentation
 * Verifies the existence and structure of offramp/quote → execute-payout → reconciliation pipeline documentation
 */

describe('Offramp Settlement Flow ADR (#1089)', () => {
  const ADR_PATH = resolve(process.cwd(), 'docs/adr/ADR-014-offramp-settlement-flow.md');

  it('should have an ADR file documenting offramp settlement flow', () => {
    expect(existsSync(ADR_PATH)).toBe(true);
  });

  it('should include ADR metadata with status, date, and deciders', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/Status:/);
    expect(content).toMatch(/Date:/);
    expect(content).toMatch(/Deciders:/);
  });

  it('should document the quote → execute-payout → reconciliation pipeline', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/quote/i);
    expect(content).toMatch(/execute-payout/i);
    expect(content).toMatch(/reconciliation/i);
    expect(content).toMatch(/offramp/i);
  });

  it('should include retry/timeout/refund branches in documentation', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/retry/i);
    expect(content).toMatch(/timeout/i);
    expect(content).toMatch(/refund/i);
  });

  it('should include a sequence diagram for the pipeline flow', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/diagram|sequence|flow|mermaid/i);
  });

  it('should document all offramp route handlers referenced in the pipeline', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/offramp\/quote/i);
    expect(content).toMatch(/offramp\/execute-payout/i);
    expect(content).toMatch(/offramp\/timeout/i);
    expect(content).toMatch(/offramp\/refund/i);
    expect(content).toMatch(/offramp\/reverse/i);
  });

  it('should include sections for context, decision, and consequences', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/## Context/i);
    expect(content).toMatch(/## Decision/i);
    expect(content).toMatch(/## Consequences/i);
  });

  it('should document failure semantics and recovery procedures', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/failure|error|exception|recovery|exception handling/i);
  });
});
