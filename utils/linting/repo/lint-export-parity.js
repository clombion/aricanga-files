#!/usr/bin/env node
/**
 * lint-export-parity.js - Snapshot/compare exports before/after restructure
 *
 * TEMPORARY LINTER - Delete after monorepo restructure is complete.
 *
 * Two modes:
 *   --snapshot  Capture current exports to .lint-cache/export-snapshot.json
 *   --compare   Compare current exports against snapshot
 *
 * Usage:
 *   node utils/linting/repo/lint-export-parity.js --snapshot  # Before restructure
 *   node utils/linting/repo/lint-export-parity.js --compare   # After restructure
 *
 * Exit code: 0 if exports match, 1 if exports differ
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const CACHE_DIR = '.lint-cache';
const SNAPSHOT_FILE = join(CACHE_DIR, 'export-snapshot.json');

// Key barrel files whose exports must be preserved
const BARREL_FILES = [
  'src/foundation/index.js',
  'src/systems/conversation/index.js',
];

// Export patterns
const EXPORT_PATTERNS = {
  namedExport: /export\s*\{([^}]+)\}/g,
  constExport: /export\s+(?:const|let|var|async\s+function|function|class)\s+(\w+)/g,
  reExportAll: /export\s*\*\s*from\s*['"]([^'"]+)['"]/g,
  reExportNamed: /export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g,
};

const args = process.argv.slice(2);
const doSnapshot = args.includes('--snapshot');
const doCompare = args.includes('--compare');

if (!doSnapshot && !doCompare) {
  console.log('Usage:');
  console.log('  --snapshot  Capture current exports');
  console.log('  --compare   Compare against snapshot');
  process.exit(1);
}

/**
 * Parse named exports from a clause like "{ foo, bar as baz }"
 */
function parseNamedExports(clause) {
  return clause
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const asMatch = s.match(/^(\w+)\s+as\s+(\w+)$/);
      return asMatch ? asMatch[2] : s;
    });
}

/**
 * Resolve import path to actual file path
 */
function resolveImportPath(importPath, sourceFile) {
  if (!importPath.startsWith('.')) return null;

  const sourceDir = dirname(sourceFile);
  let resolved = resolve(sourceDir, importPath);

  if (!resolved.endsWith('.js') && existsSync(resolved + '.js')) {
    resolved = resolved + '.js';
  }

  if (existsSync(resolved) && !resolved.endsWith('.js')) {
    const indexPath = join(resolved, 'index.js');
    if (existsSync(indexPath)) resolved = indexPath;
  }

  return existsSync(resolved) ? resolved : null;
}

/**
 * Get all exports from a JS file (including re-exports)
 */
function getExports(filePath, visited = new Set()) {
  if (visited.has(filePath)) return new Set();
  visited.add(filePath);

  if (!existsSync(filePath)) return new Set();

  const content = readFileSync(filePath, 'utf-8');
  const exports = new Set();

  let match;

  // export { foo, bar }
  const namedPattern = new RegExp(EXPORT_PATTERNS.namedExport.source, 'g');
  while ((match = namedPattern.exec(content)) !== null) {
    const afterMatch = content.slice(match.index + match[0].length, match.index + match[0].length + 50);
    if (/^\s*from\s*['"]/.test(afterMatch)) continue;
    parseNamedExports(match[1]).forEach(name => exports.add(name));
  }

  // export const foo = ...
  const constPattern = new RegExp(EXPORT_PATTERNS.constExport.source, 'g');
  while ((match = constPattern.exec(content)) !== null) {
    exports.add(match[1]);
  }

  // export * from './other.js'
  const reExportAllPattern = new RegExp(EXPORT_PATTERNS.reExportAll.source, 'g');
  while ((match = reExportAllPattern.exec(content)) !== null) {
    const reExportPath = resolveImportPath(match[1], filePath);
    if (reExportPath) {
      getExports(reExportPath, visited).forEach(name => exports.add(name));
    }
  }

  // export { foo, bar } from './other.js'
  const reExportNamedPattern = new RegExp(EXPORT_PATTERNS.reExportNamed.source, 'g');
  while ((match = reExportNamedPattern.exec(content)) !== null) {
    parseNamedExports(match[1]).forEach(name => exports.add(name));
  }

  return exports;
}

/**
 * Collect all exports from all barrel files
 */
function collectAllExports() {
  const result = {};

  for (const barrelPath of BARREL_FILES) {
    if (!existsSync(barrelPath)) {
      console.log(`  [skip] ${barrelPath} - not found`);
      continue;
    }

    const exports = getExports(barrelPath);
    result[barrelPath] = [...exports].sort();
  }

  return result;
}

// Main
if (doSnapshot) {
  console.log('Capturing export snapshot...\n');

  const exports = collectAllExports();

  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  writeFileSync(SNAPSHOT_FILE, JSON.stringify(exports, null, 2));

  console.log('Snapshot captured:');
  for (const [file, names] of Object.entries(exports)) {
    console.log(`  ${file}: ${names.length} exports`);
  }
  console.log(`\nWritten to ${SNAPSHOT_FILE}`);
  process.exit(0);
}

if (doCompare) {
  console.log('Comparing exports against snapshot...\n');

  if (!existsSync(SNAPSHOT_FILE)) {
    console.error(`Error: No snapshot found at ${SNAPSHOT_FILE}`);
    console.error('Run with --snapshot first');
    process.exit(1);
  }

  const snapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf-8'));
  const current = collectAllExports();

  const violations = [];

  for (const [file, expectedExports] of Object.entries(snapshot)) {
    const actualExports = current[file] || [];
    const expectedSet = new Set(expectedExports);
    const actualSet = new Set(actualExports);

    const missing = expectedExports.filter(e => !actualSet.has(e));
    const extra = actualExports.filter(e => !expectedSet.has(e));

    if (missing.length > 0 || extra.length > 0) {
      violations.push({ file, missing, extra });
    }
  }

  // Check for new barrel files in current that weren't in snapshot
  for (const file of Object.keys(current)) {
    if (!snapshot[file]) {
      violations.push({
        file,
        missing: [],
        extra: current[file],
        isNew: true,
      });
    }
  }

  if (violations.length === 0) {
    console.log('✓ All exports match snapshot');
    for (const [file, exports] of Object.entries(current)) {
      console.log(`  ${file}: ${exports.length} exports`);
    }
    process.exit(0);
  } else {
    console.log('Export parity violations:\n');
    for (const v of violations) {
      console.log(`  ${v.file}${v.isNew ? ' (NEW)' : ''}`);
      if (v.missing.length > 0) {
        console.log(`    Missing: ${v.missing.join(', ')}`);
      }
      if (v.extra.length > 0) {
        console.log(`    Extra: ${v.extra.join(', ')}`);
      }
      console.log();
    }
    console.log(`Found ${violations.length} file(s) with export differences`);
    process.exit(1);
  }
}
