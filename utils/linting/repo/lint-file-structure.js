#!/usr/bin/env node
/**
 * lint-file-structure.js - Validate repository file structure
 *
 * Ensures files are in expected locations after migration to the layered
 * architecture. Catches orphaned files and directories that weren't properly
 * moved or deleted.
 *
 * Checks:
 * - No unexpected directories in src/ (only allowed: foundation, implementations, systems, vendor)
 * - No loose JS files in src/ root
 * - No legacy directories (src/js/, src/data/, src/ink/, src/css/, src/dist/)
 *
 * Usage: node utils/linting/repo/lint-file-structure.js
 * Exit code: 0 if valid, 1 if violations found
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Legacy directories that should not exist (old structure)
const FORBIDDEN_DIRECTORIES = [
  'src/js',
  'src/data',
  'src/ink',
  'src/css',
  'src/dist',
  'src/foundation',     // Moved to packages/framework/src/foundation
  'src/systems',        // Moved to packages/framework/src/systems
  'src/implementations', // Moved to experiences/
];

const violations = [];

/**
 * Check for forbidden legacy directories
 */
function checkForbiddenDirectories() {
  for (const dir of FORBIDDEN_DIRECTORIES) {
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      violations.push({
        type: 'forbidden-directory',
        path: dir,
        message: `Legacy directory should be deleted: ${dir}`,
      });
    }
  }
}

/**
 * Check that required directories exist in the new structure
 */
function checkRequiredDirectories() {
  const REQUIRED_DIRS = [
    'packages/framework/src/foundation',
    'packages/framework/src/systems',
    'packages/test-utils/src',
    'experiences',
  ];

  for (const dir of REQUIRED_DIRS) {
    if (!existsSync(dir)) {
      violations.push({
        type: 'missing-required-dir',
        path: dir,
        message: `Required directory not found: ${dir}`,
      });
    }
  }
}

/**
 * Verify implementation structure (each impl should have expected subdirs)
 */
function checkImplementationStructure() {
  const implDir = 'experiences';
  if (!existsSync(implDir)) return;

  const implementations = readdirSync(implDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'));

  for (const impl of implementations) {
    const implPath = join(implDir, impl.name);

    // Each implementation should have data/ subdirectory
    const dataDir = join(implPath, 'data');
    if (!existsSync(dataDir)) {
      violations.push({
        type: 'missing-impl-data',
        path: implPath,
        message: `Implementation ${impl.name} missing data/ directory`,
      });
    }

    // Each implementation should have src/ subdirectory for JS files
    const srcDir = join(implPath, 'src');
    if (!existsSync(srcDir)) {
      violations.push({
        type: 'missing-impl-src',
        path: implPath,
        message: `Implementation ${impl.name} missing src/ directory`,
      });
    }

    // Check for loose TOML files at implementation root (should be in data/)
    const implEntries = readdirSync(implPath, { withFileTypes: true });
    for (const entry of implEntries) {
      if (entry.isFile() && entry.name.endsWith('.toml') && entry.name !== 'mise.toml') {
        violations.push({
          type: 'misplaced-toml',
          path: join(implPath, entry.name),
          message: `TOML file should be in data/: ${entry.name}`,
        });
      }
    }
  }
}

// Main
console.log('Checking file structure...\n');

checkForbiddenDirectories();
checkRequiredDirectories();
checkImplementationStructure();

if (violations.length === 0) {
  console.log('✓ File structure is valid');
  console.log(`  - No forbidden legacy directories`);
  console.log(`  - Required directories exist`);
  console.log(`  - Implementation directories properly organized`);
  process.exit(0);
} else {
  console.log('File structure violations found:\n');

  for (const v of violations) {
    console.log(`  [${v.type}] ${v.path}`);
    console.log(`    ${v.message}`);
    console.log();
  }

  console.log(`Found ${violations.length} violation(s)`);
  console.log('\nFix these issues to ensure the codebase follows the layered architecture.');
  process.exit(1);
}
