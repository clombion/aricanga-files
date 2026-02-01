#!/usr/bin/env node
/**
 * lint-barrel-completeness.js - Verify barrel files export everything expected
 *
 * Checks that index.js barrel files export all public modules from their directory.
 * Helps prevent accidental export omissions after adding new files.
 *
 * Rules:
 * - Files starting with _ are private (not expected in barrel)
 * - Files named index.js are the barrel itself
 * - Subdirectories with index.js should be re-exported
 *
 * Usage: node utils/linting/repo/lint-barrel-completeness.js
 * Exit code: 0 if all barrels complete, 1 if missing exports
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

// Directories to check for barrel completeness
// Only check leaf directories - parent barrels may selectively export
const BARREL_DIRS = [
  'packages/framework/src/foundation/core',
  'packages/framework/src/foundation/services',
  'packages/framework/src/foundation/state',
  'packages/framework/src/systems/conversation/events',
  'packages/framework/src/systems/conversation/services',
  'packages/framework/src/systems/conversation/state',
  'packages/framework/src/systems/conversation/tags',
];

// Files/patterns to ignore (not expected in barrels)
const IGNORE_PATTERNS = [
  /^_/,           // Private files
  /^index\.js$/,  // The barrel itself
  /\.test\.js$/,  // Test files
  /\.spec\.js$/,  // Spec files
  /^types\.js$/,  // Type definition files (JSDoc only)
];

// Match various export patterns in barrel files
const EXPORT_PATTERNS = {
  // export { foo } from './file.js'
  reExportNamed: /export\s*\{[^}]+\}\s*from\s*['"]\.\/([^'"]+)['"]/g,
  // export * from './file.js'
  reExportAll: /export\s*\*\s*from\s*['"]\.\/([^'"]+)['"]/g,
};

/**
 * Check if a filename should be ignored
 */
function shouldIgnore(filename) {
  return IGNORE_PATTERNS.some(p => p.test(filename));
}

/**
 * Get all exportable files in a directory
 */
function getExportableFiles(dir) {
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue;

    if (entry.isDirectory()) {
      // Check if subdirectory has an index.js
      const subIndex = join(dir, entry.name, 'index.js');
      if (existsSync(subIndex)) {
        files.push(entry.name); // Directory name for re-export
      }
    } else if (entry.name.endsWith('.js')) {
      // Remove .js extension for comparison
      files.push(entry.name.replace(/\.js$/, ''));
    }
  }

  return files;
}

/**
 * Get all files/modules exported from a barrel file
 */
function getBarrelExports(barrelPath) {
  if (!existsSync(barrelPath)) return [];

  const content = readFileSync(barrelPath, 'utf-8');
  const exports = new Set();

  let match;

  // export { ... } from './file.js'
  const namedRegex = new RegExp(EXPORT_PATTERNS.reExportNamed.source, 'g');
  while ((match = namedRegex.exec(content)) !== null) {
    // Extract the module path (e.g., './event-bus.js' -> 'event-bus')
    const modulePath = match[1].replace(/\.js$/, '').replace(/\/index$/, '');
    exports.add(modulePath);
  }

  // export * from './file.js'
  const allRegex = new RegExp(EXPORT_PATTERNS.reExportAll.source, 'g');
  while ((match = allRegex.exec(content)) !== null) {
    const modulePath = match[1].replace(/\.js$/, '').replace(/\/index$/, '');
    exports.add(modulePath);
  }

  return [...exports];
}

// Main
console.log('Checking barrel file completeness...\n');

const violations = [];

for (const dir of BARREL_DIRS) {
  const barrelPath = join(dir, 'index.js');

  if (!existsSync(barrelPath)) {
    console.log(`  [skip] ${dir} - no index.js`);
    continue;
  }

  const exportable = getExportableFiles(dir);
  const exported = getBarrelExports(barrelPath);

  const missing = exportable.filter(f => !exported.includes(f));

  if (missing.length > 0) {
    violations.push({
      barrel: barrelPath,
      missing,
    });
  }
}

if (violations.length === 0) {
  console.log(`✓ All barrel files are complete (checked ${BARREL_DIRS.length} directories)`);
  process.exit(0);
} else {
  console.log('Barrel files with missing exports:\n');
  for (const v of violations) {
    console.log(`  ${v.barrel}`);
    console.log(`    Missing: ${v.missing.join(', ')}`);
    console.log();
  }
  console.log(`Found ${violations.length} incomplete barrel(s)`);
  console.log('\nTo fix: Add export statements for the missing modules');
  process.exit(1);
}
