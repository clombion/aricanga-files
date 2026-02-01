#!/usr/bin/env node
/**
 * lint-test-paths.js - Detect hardcoded locale paths in test files
 *
 * Greps test files for hardcoded locale/config paths (e.g., `src/data/locales`)
 * that should use IMPL-aware helpers from utils/lib/locale-config.js instead.
 *
 * Usage: node utils/linting/lint-test-paths.js
 * Exit code: 0 if no hardcoded paths, 1 if violations found
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIRS = ['tests'];
const SKIP_DIRS = ['node_modules', '.tmp'];

// Patterns that indicate hardcoded paths (not using IMPL-aware helpers)
// These are legacy paths that no longer exist - code should use IMPL-aware paths
const FORBIDDEN_PATTERNS = [
  /['"]src\/data\//,
  /['"]src\/dist\//,
  /['"]src\/css\//,
  /['"]src\/ink\//,
  /['"]src\/js\//,
  // Also catch join() patterns that construct these paths
  /join\([^)]*['"]src\/data\//,
  /join\([^)]*['"]src\/dist\//,
  /join\([^)]*['"]src\/css\//,
  /join\([^)]*['"]src\/ink\//,
];

// Pattern for comments - we'll skip lines that are comments
const COMMENT_PATTERNS = [
  /^\s*\/\//,
  /^\s*\*/,
  /^\s*\/\*/,
];

/**
 * Check if a line is a comment
 */
function isComment(line) {
  return COMMENT_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Recursively get all test files
 */
function getTestFiles(dirs) {
  const files = [];

  function walk(dir) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
  }

  for (const dir of dirs) {
    walk(dir);
  }

  return files;
}

/**
 * Check a file for hardcoded paths
 */
function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments
    if (isComment(line)) continue;

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: filePath,
          line: lineNum,
          content: line.trim().slice(0, 80),
        });
        break; // Only report once per line
      }
    }
  }

  return violations;
}

// Main
const files = getTestFiles(TEST_DIRS);
let allViolations = [];

for (const file of files) {
  const violations = checkFile(file);
  allViolations = allViolations.concat(violations);
}

if (allViolations.length > 0) {
  console.error(`\nHardcoded locale paths found in test files:`);
  console.error(`Use IMPL-aware helpers from locale-config.ts instead.\n`);

  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.content}`);
  }

  console.error(`\nTotal: ${allViolations.length} violations`);
  console.error(`\nFix: Import and use helpers from tests/implementation/locale-config.ts:`);
  console.error(`  import { getLocalesDir, getBaseConfigPath, getLocalePath } from '../locale-config';`);
  process.exit(1);
} else {
  console.log('No hardcoded locale paths found in test files.');
  process.exit(0);
}
