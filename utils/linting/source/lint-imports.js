#!/usr/bin/env node
/**
 * lint-imports.js - Verify named imports exist in target modules
 *
 * Scans JS files for named imports and verifies the exports exist.
 * Catches stale imports from refactoring (e.g., createLayerContext to createSystemContext).
 *
 * Usage: node utils/linting/lint-imports.js
 * Exit code: 0 if all imports valid, 1 if broken imports found
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const SOURCE_DIRS = [
  'packages/framework/src/foundation',
  'packages/framework/src/systems',
  'implementations',
  'experiences',
];

// Package alias mappings (workspace packages)
// Maps package name to its entry point relative to repo root
const PACKAGE_ALIASES = {
  '@narratives/framework': 'packages/framework/src/index.js',
  '@narratives/framework/foundation': 'packages/framework/src/foundation/index.js',
  '@narratives/framework/systems/conversation':
    'packages/framework/src/systems/conversation/index.js',
};

const SKIP_DIRS = ['generated', 'vendor', 'node_modules'];

// Match: import { foo, bar } from './path.js'
// Also matches: import { foo as bar } from './path.js'
const IMPORT_PATTERN = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;

// Match various export patterns
const EXPORT_PATTERNS = {
  // export { foo, bar }
  namedExport: /export\s*\{([^}]+)\}/g,
  // export const foo = ... (including async function)
  constExport: /export\s+(?:const|let|var|async\s+function|function|class)\s+(\w+)/g,
  // export default ...
  defaultExport: /export\s+default\s+/g,
  // export * from './other.js' (re-export all)
  reExportAll: /export\s*\*\s*from\s*['"]([^'"]+)['"]/g,
  // export { foo, bar } from './other.js' (re-export named)
  reExportNamed: /export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g,
};

/**
 * Recursively get all JS files in directories
 */
function getJsFiles(dirs) {
  const files = [];

  function walk(dir) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (SKIP_DIRS.includes(entry.name)) continue;

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.js')) {
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
 * Strip comments from JS content to avoid false positives from examples in JSDoc
 */
function stripComments(content) {
  // Remove block comments (/* ... */)
  let result = content.replace(/\/\*[\s\S]*?\*\//g, match => {
    // Preserve line count by replacing with same number of newlines
    return match.replace(/[^\n]/g, ' ');
  });
  // Remove line comments (// ...)
  result = result.replace(/\/\/.*$/gm, '');
  return result;
}

/**
 * Parse named imports/exports from a clause
 * Handles: { foo, bar, baz as qux }
 * @param {string} clause - The import/export clause
 * @param {Object} options
 * @param {boolean} options.getAlias - If true, return alias (exported name); if false, return source name
 */
function parseNamedImports(clause, { getAlias = false } = {}) {
  return clause
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      // Handle "foo as bar" - return alias (bar) or source (foo) based on option
      const asMatch = s.match(/^(\w+)\s+as\s+(\w+)$/);
      if (asMatch) {
        return getAlias ? asMatch[2] : asMatch[1];
      }
      return s;
    });
}

/**
 * Resolve import path to actual file path
 */
function resolveImportPath(importPath, sourceFile) {
  // Check for known package aliases first
  if (PACKAGE_ALIASES[importPath]) {
    const resolved = resolve(process.cwd(), PACKAGE_ALIASES[importPath]);
    return existsSync(resolved) ? resolved : null;
  }

  // Skip other external packages (not in our alias map)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  const sourceDir = dirname(sourceFile);
  let resolved = resolve(sourceDir, importPath);

  // Try adding .js if not present
  if (!resolved.endsWith('.js') && existsSync(resolved + '.js')) {
    resolved = resolved + '.js';
  }

  // Handle directory imports (index.js)
  if (existsSync(resolved) && !resolved.endsWith('.js')) {
    const indexPath = join(resolved, 'index.js');
    if (existsSync(indexPath)) {
      resolved = indexPath;
    }
  }

  return existsSync(resolved) ? resolved : null;
}

/**
 * Get all exports from a JS file (including re-exports)
 * Returns Set of exported names
 */
function getExports(filePath, visited = new Set()) {
  // Prevent infinite loops from circular re-exports
  if (visited.has(filePath)) return new Set();
  visited.add(filePath);

  if (!existsSync(filePath)) return new Set();

  const content = readFileSync(filePath, 'utf-8');
  const exports = new Set();

  // export { foo, bar }
  let match;
  const namedPattern = new RegExp(EXPORT_PATTERNS.namedExport.source, 'g');
  while ((match = namedPattern.exec(content)) !== null) {
    // Skip if this is a re-export (has "from")
    const afterMatch = content.slice(match.index + match[0].length, match.index + match[0].length + 50);
    if (/^\s*from\s*['"]/.test(afterMatch)) continue;

    parseNamedImports(match[1], { getAlias: true }).forEach(name => {
      exports.add(name);
    });
  }

  // export const foo = ...
  const constPattern = new RegExp(EXPORT_PATTERNS.constExport.source, 'g');
  while ((match = constPattern.exec(content)) !== null) {
    exports.add(match[1]);
  }

  // export default -> adds "default"
  if (EXPORT_PATTERNS.defaultExport.test(content)) {
    exports.add('default');
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
    parseNamedImports(match[1], { getAlias: true }).forEach(name => {
      exports.add(name);
    });
  }

  return exports;
}

/**
 * Extract imports from a JS file (strips comments first)
 */
function extractImports(content, filePath) {
  const imports = [];
  let match;

  // Strip comments to avoid matching imports in JSDoc examples
  const strippedContent = stripComments(content);

  const pattern = new RegExp(IMPORT_PATTERN.source, 'g');
  while ((match = pattern.exec(strippedContent)) !== null) {
    const names = parseNamedImports(match[1]);
    const importPath = match[2];
    const line = strippedContent.substring(0, match.index).split('\n').length;

    imports.push({ names, importPath, line });
  }

  return imports;
}

// Main
console.log('Checking import/export consistency...\n');

const files = getJsFiles(SOURCE_DIRS);
const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const imports = extractImports(content, file);

  for (const imp of imports) {
    const targetPath = resolveImportPath(imp.importPath, file);

    // Skip external packages
    if (targetPath === null && !imp.importPath.startsWith('.')) {
      continue;
    }

    if (!targetPath) {
      violations.push({
        file,
        line: imp.line,
        importPath: imp.importPath,
        missing: ['(file not found)'],
      });
      continue;
    }

    const exports = getExports(targetPath);
    const missingExports = imp.names.filter(name => !exports.has(name));

    if (missingExports.length > 0) {
      violations.push({
        file,
        line: imp.line,
        importPath: imp.importPath,
        targetPath,
        missing: missingExports,
        available: [...exports].slice(0, 10), // Show first 10 for debugging
      });
    }
  }
}

if (violations.length === 0) {
  console.log(`✓ All imports valid (checked ${files.length} files)`);
  process.exit(0);
} else {
  console.log('Import violations found:\n');
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    import { ${v.missing.join(', ')} } from '${v.importPath}'`);
    if (v.available && v.available.length > 0) {
      console.log(`    Available exports: ${v.available.join(', ')}`);
    }
    console.log();
  }
  console.log(`Found ${violations.length} import violation(s)`);
  process.exit(1);
}
