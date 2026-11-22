/**
 * Quality Gate: Root Directory Cleanliness
 *
 * PURPOSE:
 *   Ensures that no stale scratch files, task notes, or completion reports
 *   are committed to the repository root. These file types clutter the root,
 *   mislead contributors, and have been a recurring issue (see #1541).
 *
 *   The .gitignore patterns that block these files are enforced at commit time,
 *   but this test provides a CI-level regression guard: if a banned pattern
 *   ever appears in the root, the quality gate fails and the PR cannot merge.
 *
 * BANNED PATTERNS:
 *   - task*.md           — per-issue task notes
 *   - DELIVERABLES*.txt  — completion checklists
 *   - ACCEPTANCE_VERIFICATION*.md
 *   - ERROR_HANDLER_AUDIT*.md
 *   - *_COMPLETION_REPORT.md
 *   - *_AUDIT.md         — ad hoc audit summaries
 *   - IMPLEMENTATION_*.md / *_IMPLEMENTATION.md
 *   - PR_DESCRIPTION*.md
 *
 * ALLOWED ROOTS:
 *   See docs/scratch-file-convention.md for the full list of files permitted
 *   in the repository root and guidance on where other content belongs.
 *
 * Related: docs/scratch-file-convention.md, .gitignore, Issue #1541
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());

/** Glob-style patterns converted to RegExp for banned root filenames. */
const BANNED_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /^task\d*\.md$/i, description: 'task note files (task*.md)' },
  {
    pattern: /^DELIVERABLES.*\.txt$/i,
    description: 'deliverable checklist files (DELIVERABLES*.txt)',
  },
  { pattern: /^ACCEPTANCE_VERIFICATION.*\.md$/i, description: 'acceptance verification files' },
  { pattern: /^ERROR_HANDLER_AUDIT.*\.md$/i, description: 'error handler audit files' },
  {
    pattern: /.*_COMPLETION_REPORT\.md$/i,
    description: 'completion report files (*_COMPLETION_REPORT.md)',
  },
  { pattern: /.*_AUDIT\.md$/i, description: 'ad hoc audit summary files (*_AUDIT.md)' },
  {
    pattern: /^IMPLEMENTATION_.*\.md$/i,
    description: 'implementation summary files (IMPLEMENTATION_*.md)',
  },
  {
    pattern: /.*_IMPLEMENTATION\.md$/i,
    description: 'implementation summary files (*_IMPLEMENTATION.md)',
  },
  {
    pattern: /^PR_DESCRIPTION.*\.md$/i,
    description: 'PR description scratch files (PR_DESCRIPTION*.md)',
  },
];

describe('Quality Gate — Root Directory Cleanliness', () => {
  it('root directory contains no banned scratch or stale files', () => {
    const rootEntries = fs.readdirSync(ROOT, { withFileTypes: true });
    const rootFiles = rootEntries.filter((e) => e.isFile()).map((e) => e.name);

    const violations: string[] = [];

    for (const file of rootFiles) {
      for (const { pattern, description } of BANNED_PATTERNS) {
        if (pattern.test(file)) {
          violations.push(`  - "${file}" matches banned pattern: ${description}`);
          break;
        }
      }
    }

    if (violations.length > 0) {
      expect.fail(
        'Banned files found in repository root:\n' +
          violations.join('\n') +
          '\n\nAction: Remove these files or move their content to CHANGELOG.md / docs/.' +
          '\nSee docs/scratch-file-convention.md and .gitignore for the full policy.',
      );
    }

    expect(violations).toHaveLength(0);
  });

  it('scratch file convention is documented', () => {
    const docPath = path.join(ROOT, 'docs', 'scratch-file-convention.md');
    expect(
      fs.existsSync(docPath),
      'docs/scratch-file-convention.md must exist to document the root file policy',
    ).toBe(true);

    const content = fs.readFileSync(docPath, 'utf-8');
    expect(content).toContain('Allowed files in the repository root');
    expect(content).toContain('Gitignored scratch');
  });

  it('.gitignore contains guards for banned file patterns', () => {
    const gitignorePath = path.join(ROOT, '.gitignore');
    expect(fs.existsSync(gitignorePath), '.gitignore must exist').toBe(true);

    const content = fs.readFileSync(gitignorePath, 'utf-8');
    // Verify at least the key patterns are gitignored
    expect(content).toContain('task*.md');
    expect(content).toContain('DELIVERABLES');
    expect(content).toContain('ACCEPTANCE_VERIFICATION');
  });
});
