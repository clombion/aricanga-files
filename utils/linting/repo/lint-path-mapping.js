#!/usr/bin/env node
/**
 * lint-path-mapping.js - Preview restructure breakage
 *
 * TEMPORARY LINTER - Delete after monorepo restructure is complete.
 *
 * Shows all files that will need path updates during the restructure.
 * Uses the PATH_MAPPING to preview what will break and needs fixing.
 *
 * Usage:
 *   node utils/linting/repo/lint-path-mapping.js          # Preview breakage
 *   node utils/linting/repo/lint-path-mapping.js --json   # Output JSON report
 *
 * Exit code: 0 (informational only)
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const CACHE_DIR = '.lint-cache';

// Planned path mapping for restructure
const PATH_MAPPING = {
  // Framework code
  'src/foundation/': 'packages/framework/src/foundation/',
  'src/systems/': 'packages/framework/src/systems/',
  'src/vendor/xstate/': 'packages/framework/src/vendor/xstate/',

  // Test infrastructure
  'tests/shared/': 'packages/test-utils/src/',
  'tests/engine/': 'packages/tests/',

  // Implementation code
  'src/experiences/aricanga/': 'experiences/aricanga/src/',

  // Implementation tests (by type)
  'tests/implementation/aricanga/': 'experiences/aricanga/tests/',
  'tests/implementation/e2e/': 'experiences/aricanga/tests/e2e/',
  'tests/implementation/i18n/': 'experiences/aricanga/tests/i18n/',
  'tests/implementation/unit/': 'experiences/aricanga/tests/unit/',
  'tests/implementation/contract/': 'experiences/aricanga/tests/contract/',

  // Quality tests - STAY AT ROOT
  'packages/tests/quality/': 'packages/tests/quality/',

  // Templates - STAY AT ROOT
  'templates/': 'templates/',

  // Utils - STAY AT ROOT
  'utils/': 'utils/',
};

// Files to scan for import paths
const SCAN_DIRS = [
  'src',
  'tests',
  'experience-templates',
  'utils',
];

const SKIP_DIRS = ['node_modules', 'dist', 'vendor', '.git', 'data', 'ink', 'css', 'assets', 'generated'];

// Import patterns to find
const IMPORT_PATTERN = /(?:import|export)\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;

const args = process.argv.slice(2);
const outputJson = args.includes('--json');

/**
 * Get all JS/TS files
 */
function getSourceFiles(dirs) {
  const files = [];

  function walk(dir) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(js|ts|tpl)$/.test(entry.name)) {
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
 * Find imports that reference paths being moved
 */
function findAffectedImports(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const affected = [];

  let match;
  const importRegex = new RegExp(IMPORT_PATTERN.source, 'g');

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];

    // Skip external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) continue;

    // Resolve relative import to absolute path
    const fileDir = dirname(filePath);
    const resolvedPath = join(fileDir, importPath).replace(/\\/g, '/');

    // Check if this import targets a path that's being moved
    for (const [oldPath, newPath] of Object.entries(PATH_MAPPING)) {
      if (resolvedPath.includes(oldPath.replace(/\/$/, '')) ||
          importPath.includes(oldPath.replace(/\/$/, ''))) {
        const line = content.substring(0, match.index).split('\n').length;
        affected.push({
          line,
          import: importPath,
          resolved: resolvedPath,
          from: oldPath,
          to: newPath,
        });
        break;
      }
    }
  }

  return affected;
}

/**
 * Check which source files will move
 */
function findFilesToMove() {
  const moves = [];

  for (const [oldPath, newPath] of Object.entries(PATH_MAPPING)) {
    if (oldPath === newPath) continue;  // Not moving
    if (!existsSync(oldPath.replace(/\/$/, ''))) continue;

    moves.push({
      from: oldPath,
      to: newPath,
    });
  }

  return moves;
}

// Main
console.log('Analyzing path mapping for restructure...\n');

// Files that will move
const fileMoves = findFilesToMove();
console.log('Directories to move:');
for (const move of fileMoves) {
  if (move.from !== move.to) {
    console.log(`  ${move.from} → ${move.to}`);
  } else {
    console.log(`  ${move.from} (stays)`);
  }
}
console.log();

// Files with imports that need updating
const sourceFiles = getSourceFiles(SCAN_DIRS);
const affectedFiles = [];

for (const file of sourceFiles) {
  const affected = findAffectedImports(file);
  if (affected.length > 0) {
    affectedFiles.push({
      file,
      imports: affected,
    });
  }
}

console.log(`Files with imports to update: ${affectedFiles.length}\n`);

if (affectedFiles.length > 0) {
  // Group by directory
  const byDir = {};
  for (const af of affectedFiles) {
    const dir = dirname(af.file);
    if (!byDir[dir]) byDir[dir] = [];
    byDir[dir].push(af);
  }

  for (const [dir, files] of Object.entries(byDir)) {
    console.log(`  ${dir}/`);
    for (const f of files) {
      console.log(`    ${f.file.split('/').pop()}: ${f.imports.length} import(s)`);
    }
  }
}

// Summary
console.log('\n--- Summary ---');
console.log(`Total directories moving: ${fileMoves.filter(m => m.from !== m.to).length}`);
console.log(`Total files with imports to update: ${affectedFiles.length}`);
console.log(`Total imports to update: ${affectedFiles.reduce((sum, f) => sum + f.imports.length, 0)}`);

if (outputJson) {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  const report = {
    mapping: PATH_MAPPING,
    fileMoves,
    affectedFiles,
    summary: {
      directoriesMoving: fileMoves.filter(m => m.from !== m.to).length,
      filesNeedingUpdate: affectedFiles.length,
      importsToUpdate: affectedFiles.reduce((sum, f) => sum + f.imports.length, 0),
    },
  };

  const outPath = join(CACHE_DIR, 'path-mapping-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${outPath}`);
}

// This linter is informational - always exit 0
process.exit(0);
