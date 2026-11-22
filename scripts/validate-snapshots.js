#!/usr/bin/env node

/**
 * Snapshot Hygiene Validator
 * Ensures all snapshot files are in sync with their test files and have no orphaned entries
 * Issue #1346
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const SNAPSHOT_GLOB = 'src/**/__snapshots__/**/*.snap';
const TEST_FILE_EXTENSIONS = ['.test.ts', '.test.tsx'];

console.log('🔍 Validating snapshot hygiene...\n');

let hasErrors = false;

// Find all snapshot files
const snapshots = globSync(SNAPSHOT_GLOB);

snapshots.forEach((snapshotPath) => {
  // Derive the test file path
  // Example: src/lib/__snapshots__/formatters.test.ts.snap → src/lib/formatters.test.ts
  const dir = path.dirname(snapshotPath).replace('__snapshots__', '');
  const filename = path.basename(snapshotPath).replace('.snap', '');
  const testFile = path.join(dir, filename);

  // Check if corresponding test file exists
  if (!fs.existsSync(testFile)) {
    console.error(`❌ Orphaned snapshot: ${snapshotPath}`);
    console.error(`   Expected test file: ${testFile} (does not exist)`);
    hasErrors = true;
  } else {
    // Validate snapshot content format
    try {
      const content = fs.readFileSync(snapshotPath, 'utf-8');

      // Check for valid snapshot format (should contain exports)
      if (!content.includes('exports[')) {
        console.warn(`⚠️  Snapshot may be invalid format: ${snapshotPath}`);
        console.warn('   Snapshots should contain exports[] entries');
      }

      // Check for trailing whitespace (formatting issue)
      const lines = content.split('\n');
      let hasTrailingWhitespace = false;
      lines.forEach((line, idx) => {
        if (line.match(/\s+$/)) {
          hasTrailingWhitespace = true;
        }
      });

      if (hasTrailingWhitespace) {
        console.warn(`⚠️  Snapshot has trailing whitespace: ${snapshotPath}`);
        console.warn('   Run: npm run test:snapshots:update to fix formatting');
      }
    } catch (err) {
      console.error(`❌ Failed to read snapshot: ${snapshotPath}`);
      console.error(`   Error: ${err.message}`);
      hasErrors = true;
    }
  }
});

// Find all test files and check for corresponding snapshots
const testFiles = globSync('src/**/*.test.{ts,tsx}').filter((file) => {
  // Skip test files that are in __snapshots__ directories themselves
  return !file.includes('__snapshots__');
});

testFiles.forEach((testFile) => {
  // Check if this test file is expected to have a snapshot
  const testContent = fs.readFileSync(testFile, 'utf-8');
  const hasSnapshotCalls =
    testContent.includes('.toMatchSnapshot()') || testContent.includes('expect().toMatchSnapshot');

  if (hasSnapshotCalls) {
    // Derive expected snapshot path
    // Example: src/lib/formatters.test.ts → src/lib/__snapshots__/formatters.test.ts.snap
    const dir = path.dirname(testFile);
    const filename = path.basename(testFile);
    const expectedSnapshotPath = path.join(dir, '__snapshots__', `${filename}.snap`);

    if (!fs.existsSync(expectedSnapshotPath)) {
      console.warn(`⚠️  Missing snapshot file: ${expectedSnapshotPath}`);
      console.warn(`   Run: npm run test:snapshots:update -- ${testFile}`);
    }
  }
});

if (hasErrors) {
  console.error('\n❌ Snapshot validation failed');
  process.exit(1);
} else if (snapshots.length === 0) {
  console.log('✅ No snapshot files found (or all are valid)');
} else {
  console.log(`✅ Snapshot hygiene check passed (${snapshots.length} snapshot files validated)`);
}
