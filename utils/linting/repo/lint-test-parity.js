#!/usr/bin/env node
/**
 * lint-test-parity.js - Snapshot/compare test inventory before/after restructure
 *
 * TEMPORARY LINTER - Delete after monorepo restructure is complete.
 *
 * Two modes:
 *   --snapshot  Capture current test file inventory to .lint-cache/test-inventory.json
 *   --compare   Compare current tests against snapshot
 *
 * Usage:
 *   node utils/linting/repo/lint-test-parity.js --snapshot  # Before restructure
 *   node utils/linting/repo/lint-test-parity.js --compare   # After restructure
 *
 * Exit code: 0 if tests match, 1 if tests differ
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const CACHE_DIR = '.lint-cache';
const SNAPSHOT_FILE = join(CACHE_DIR, 'test-inventory.json');

// Test directories to scan
const TEST_DIRS = [
  'tests',
  'packages/framework/tests',      // After restructure
  'packages/test-utils/src',       // After restructure
  'experiences/aricanga/tests', // After restructure
];

// Test file patterns
const TEST_PATTERNS = [
  /\.test\.[jt]s$/,
  /\.spec\.[jt]s$/,
];

const args = process.argv.slice(2);
const doSnapshot = args.includes('--snapshot');
const doCompare = args.includes('--compare');

if (!doSnapshot && !doCompare) {
  console.log('Usage:');
  console.log('  --snapshot  Capture current test inventory');
  console.log('  --compare   Compare against snapshot');
  process.exit(1);
}

/**
 * Check if a file is a test file
 */
function isTestFile(filename) {
  return TEST_PATTERNS.some(p => p.test(filename));
}

/**
 * Recursively get all test files
 */
function getTestFiles(dir) {
  const files = [];

  function walk(currentDir, category = '') {
    if (!existsSync(currentDir)) return;

    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;

      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Determine category from first-level directory
        const newCategory = category || entry.name;
        walk(fullPath, newCategory);
      } else if (isTestFile(entry.name)) {
        files.push({
          path: relative(process.cwd(), fullPath),
          name: basename(entry.name),
          category,
        });
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Collect all test files from all test directories
 */
function collectTestInventory() {
  const inventory = {
    files: [],
    byCategory: {},
    total: 0,
  };

  for (const dir of TEST_DIRS) {
    const tests = getTestFiles(dir);
    inventory.files.push(...tests);
  }

  // Group by category
  for (const test of inventory.files) {
    if (!inventory.byCategory[test.category]) {
      inventory.byCategory[test.category] = [];
    }
    inventory.byCategory[test.category].push(test.name);
  }

  inventory.total = inventory.files.length;

  return inventory;
}

// Main
if (doSnapshot) {
  console.log('Capturing test inventory snapshot...\n');

  const inventory = collectTestInventory();

  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  writeFileSync(SNAPSHOT_FILE, JSON.stringify(inventory, null, 2));

  console.log('Test inventory:');
  for (const [category, tests] of Object.entries(inventory.byCategory)) {
    console.log(`  ${category}: ${tests.length} test(s)`);
  }
  console.log(`\nTotal: ${inventory.total} test file(s)`);
  console.log(`Written to ${SNAPSHOT_FILE}`);
  process.exit(0);
}

if (doCompare) {
  console.log('Comparing test inventory against snapshot...\n');

  if (!existsSync(SNAPSHOT_FILE)) {
    console.error(`Error: No snapshot found at ${SNAPSHOT_FILE}`);
    console.error('Run with --snapshot first');
    process.exit(1);
  }

  const snapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf-8'));
  const current = collectTestInventory();

  // Compare by test file name (path-independent)
  const snapshotNames = new Set(snapshot.files.map(f => f.name));
  const currentNames = new Set(current.files.map(f => f.name));

  const missing = [...snapshotNames].filter(n => !currentNames.has(n));
  const extra = [...currentNames].filter(n => !snapshotNames.has(n));

  console.log(`Snapshot: ${snapshot.total} test(s)`);
  console.log(`Current:  ${current.total} test(s)\n`);

  if (missing.length === 0 && extra.length === 0) {
    console.log('✓ All test files accounted for');

    // Show mapping if files moved
    const movedFiles = current.files.filter(f => {
      const snapshotFile = snapshot.files.find(sf => sf.name === f.name);
      return snapshotFile && snapshotFile.path !== f.path;
    });

    if (movedFiles.length > 0) {
      console.log('\nMoved test files:');
      for (const f of movedFiles) {
        const original = snapshot.files.find(sf => sf.name === f.name);
        console.log(`  ${original.path}`);
        console.log(`    → ${f.path}`);
      }
    }

    process.exit(0);
  } else {
    console.log('Test inventory differences:\n');

    if (missing.length > 0) {
      console.log('Missing tests (in snapshot but not found):');
      for (const name of missing) {
        const original = snapshot.files.find(f => f.name === name);
        console.log(`  ${original.path}`);
      }
      console.log();
    }

    if (extra.length > 0) {
      console.log('New tests (not in snapshot):');
      for (const name of extra) {
        const newFile = current.files.find(f => f.name === name);
        console.log(`  ${newFile.path}`);
      }
      console.log();
    }

    console.log(`Missing: ${missing.length}, Extra: ${extra.length}`);
    process.exit(1);
  }
}
