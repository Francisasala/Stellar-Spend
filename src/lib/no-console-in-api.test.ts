import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const API_DIR = join(__dirname, '..', 'app', 'api');
const CONSOLE_CALL = /console\.(log|error|warn|info|debug)\s*\(/;

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  let files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files = files.concat(collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Regression guard for Issue 4: zero ad hoc console.* calls under
 * src/app/api — everything must go through src/lib/logger.ts instead.
 * See docs/api-structured-logging-audit.md.
 */
describe('src/app/api structured logging', () => {
  it('contains no console.log/error/warn/info/debug calls', () => {
    const offenders: string[] = [];
    for (const file of collectFiles(API_DIR)) {
      const content = readFileSync(file, 'utf8');
      if (CONSOLE_CALL.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
