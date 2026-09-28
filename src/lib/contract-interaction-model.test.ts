import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Issue #1086: Tests for contract interaction model ADR
 * Verifies ADR documents treasury/escrow/fee-manager/multisig-authority contract architecture and rationale
 */

describe('Contract Interaction Model ADR (#1086)', () => {
  const ADR_PATH = resolve(process.cwd(), 'docs/adr/ADR-015-contract-interaction-model.md');
  const DIAGRAMS_PATH = resolve(process.cwd(), 'docs/diagrams/contract-interaction-flow.md');

  it('should have an ADR file for contract interaction model', () => {
    expect(existsSync(ADR_PATH)).toBe(true);
  });

  it('should have a diagram documenting contract call flow', () => {
    expect(existsSync(DIAGRAMS_PATH)).toBe(true);
  });

  it('should include ADR metadata with status, date, and deciders', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/Status:/);
    expect(content).toMatch(/Date:/);
    expect(content).toMatch(/Deciders:/);
  });

  it('should document all four core Soroban contracts', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/treasury/i);
    expect(content).toMatch(/escrow/i);
    expect(content).toMatch(/fee.?manager/i);
    expect(content).toMatch(/multisig.?authority/i);
  });

  it('should explain why contracts are separate deployables', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/separate|modular|independent|deployable|why/i);
    expect(content).toMatch(/reason|justification|rationale/i);
  });

  it('should document cross-contract call patterns', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/call|invoke|cross.?contract|interface|interaction/i);
  });

  it('should include rationale for not merging into a single contract', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/single|monolithic|merge|combined|alternative/i);
  });

  it('should document trade-offs between separation and integration', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/trade.?off|tradeoff|advantage|disadvantage|consequence/i);
  });

  it('should include sections for context, decision, and consequences', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/## Context/i);
    expect(content).toMatch(/## Decision/i);
    expect(content).toMatch(/## Consequences/i);
  });

  it('should have a diagram showing contract interactions', () => {
    const content = readFileSync(DIAGRAMS_PATH, 'utf-8');
    expect(content).toMatch(/treasury|escrow|fee.?manager|multisig/i);
    expect(content).toMatch(/diagram|flow|interaction|call|arrow/i);
  });

  it('should document contract ownership and authorization', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/owner|authority|admin|permission|authorization/i);
  });

  it('should explain data flow between contracts', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/data.?flow|flow|state|transfer|payment/i);
  });

  it('should document versioning and upgrade strategy for contracts', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toMatch(/version|upgrade|migration|backward.?compatibility/i);
  });
});
