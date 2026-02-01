#!/usr/bin/env node
/**
 * lint-external-functions.js - Verify external functions use shared module
 *
 * CQO-27: External Function Centralization
 * All ink external functions must be defined in the shared module at:
 * packages/framework/src/systems/conversation/ink/external-functions.js
 *
 * This prevents:
 * - Function signature drift between build and runtime
 * - Duplicated behavior definitions
 * - Inconsistent fallback handling
 *
 * Usage: node utils/linting/repo/lint-external-functions.js
 * Exit code: 0 if all valid, 1 if violations found
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// The canonical external functions module
const EXTERNAL_FUNCTIONS_MODULE =
  'packages/framework/src/systems/conversation/ink/external-functions.js';

// Pattern to detect inline BindExternalFunction calls
const BIND_PATTERN = /\.BindExternalFunction\s*\(/g;

// Pattern to detect import from external-functions module
const IMPORT_PATTERN = /from\s+['"].*external-functions(?:\.js)?['"]/;

// Directories to scan for JS files
const SCAN_DIRS = [
  'packages',
  'utils',
  'experiences',
];

// Files allowed to use BindExternalFunction:
// - external-functions.js: The canonical module
// - ink-runtime.js: Wrapper that receives functions from external-functions
// - vendor/ink.js: The ink library itself
const ALLOWED_FILES = [
  EXTERNAL_FUNCTIONS_MODULE,
  'packages/framework/src/foundation/core/ink-runtime.js',
  'packages/framework/src/vendor/ink.js',
];

/**
 * Recursively get all JS files in a directory
 */
function getJsFiles(dir) {
  if (!existsSync(dir)) return [];

  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // Skip node_modules and hidden dirs
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    if (entry.isDirectory()) {
      files.push(...getJsFiles(fullPath));
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function main() {
  console.log('Checking external function centralization (CQO-27)...\n');

  const violations = [];
  const checked = [];

  for (const dir of SCAN_DIRS) {
    const files = getJsFiles(dir);

    for (const file of files) {
      // Skip the canonical module
      if (ALLOWED_FILES.includes(file)) continue;

      const content = readFileSync(file, 'utf-8');

      // Check if file uses BindExternalFunction
      const bindMatches = content.match(BIND_PATTERN);
      if (!bindMatches) continue;

      checked.push(file);

      // Check if file imports from external-functions module
      const hasImport = IMPORT_PATTERN.test(content);

      if (!hasImport) {
        // Find lines with direct bindings
        const lines = content.split('\n');
        const bindLines = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('BindExternalFunction')) {
            bindLines.push(i + 1);
          }
        }

        violations.push({
          file,
          message:
            'Uses BindExternalFunction without importing from external-functions module',
          lines: bindLines,
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log(
      `✓ All external function usage centralized (checked ${checked.length} files with BindExternalFunction)`
    );
    process.exit(0);
  }

  console.log('External function centralization violations:\n');
  for (const v of violations) {
    console.log(`  ${v.file}`);
    console.log(`    ${v.message}`);
    console.log(`    Lines: ${v.lines.join(', ')}`);
    console.log();
  }

  console.log(`Found ${violations.length} violation(s)`);
  console.log(
    `\nAll BindExternalFunction calls should use:\n  import { createBuildExternalFunctions, bindExternalFunctions } from '${EXTERNAL_FUNCTIONS_MODULE}'\n`
  );
  process.exit(1);
}

main();
