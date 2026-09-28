import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Issue #1087: Tests for unified local dev setup guide documentation
 * Verifies comprehensive documentation for Node/Rust toolchain, docker-compose setup, and contract builds
 */

describe('Unified Local Dev Setup Guide (#1087)', () => {
  const DEV_GUIDE_PATH = resolve(process.cwd(), 'docs/local-dev-setup.md');
  const README_PATH = resolve(process.cwd(), 'README.md');

  it('should have a dedicated local dev setup guide', () => {
    expect(existsSync(DEV_GUIDE_PATH)).toBe(true);
  });

  it('should document required Node.js and Rust toolchain versions', () => {
    const content = readFileSync(DEV_GUIDE_PATH, 'utf-8');
    expect(content).toMatch(/node|nodejs|npm|yarn/i);
    expect(content).toMatch(/rust|rustup|cargo/i);
    expect(content).toMatch(/version|require|minimum/i);
  });

  it('should include installation instructions for Node toolchain', () => {
    const content = readFileSync(DEV_GUIDE_PATH, 'utf-8');
    expect(content).toMatch(/npm.*install|yarn.*install|npm.*run.*dev|npm run dev/i);
  });

  it('should document Rust contract build and test commands', () => {
    const content = readFileSync(DEV_GUIDE_PATH, 'utf-8');
    expect(content).toMatch(/cargo|contracts|soroban/i);
    expect(content).toMatch(/build|test|audit/i);
  });

  it('should document docker-compose.yml setup and usage', () => {
    const content = readFileSync(DEV_GUIDE_PATH, 'utf-8');
    expect(content).toMatch(/docker-compose/i);
    expect(content).toMatch(/docker-compose\.yml/i);
  });

  it('should differentiate between docker-compose.yml and docker-compose.canary.yml', () => {
    const content = readFileSync(DEV_GUIDE_PATH, 'utf-8');
    expect(content).toMatch(/docker-compose\.canary\.yml/i);
    expect(content).toMatch(/canary|production|environment|use.?case/i);
  });

  it('should explain when to use each docker-compose variant', () => {
    const content = readFileSync(DEV_GUIDE_PATH, 'utf-8');
    expect(content).toMatch(/development|canary|production|when|use|scenario/i);
  });

  it('should include contract audit script documentation', () => {
    const content = readFileSync(DEV_GUIDE_PATH, 'utf-8');
    expect(content).toMatch(/audit:contracts|npm run audit/i);
  });

  it('should have step-by-step setup instructions', () => {
    const content = readFileSync(DEV_GUIDE_PATH, 'utf-8');
    expect(content).toMatch(/step|clone|install|setup|npm run/i);
  });

  it('should be linked from README.md', () => {
    const readmeContent = readFileSync(README_PATH, 'utf-8');
    expect(readmeContent).toMatch(/local.?dev|dev.*setup|docs\/local-dev-setup/i);
  });

  it('should include troubleshooting section for common setup issues', () => {
    const content = readFileSync(DEV_GUIDE_PATH, 'utf-8');
    expect(content).toMatch(/troubleshoot|issue|error|help|problem|faq/i);
  });

  it('should be verified against actual project structure', () => {
    expect(existsSync(resolve(process.cwd(), 'contracts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'docker-compose.yml'))).toBe(true);
  });
});
