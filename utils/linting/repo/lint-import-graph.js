#!/usr/bin/env node
/**
 * lint-import-graph.js - Build dependency graph of all imports
 *
 * Generates a full import/export dependency graph for the codebase.
 * Used to detect circular dependencies and understand module relationships.
 *
 * Usage:
 *   node utils/linting/repo/lint-import-graph.js           # Check for cycles
 *   node utils/linting/repo/lint-import-graph.js --json    # Output JSON graph
 *   node utils/linting/repo/lint-import-graph.js --dot     # Output DOT format
 *
 * Output (--json): .lint-cache/import-graph.json
 *
 * Exit code: 0 if no cycles, 1 if circular dependencies found
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const SOURCE_DIRS = [
  'packages/framework/src/foundation',
  'packages/framework/src/systems',
  'implementations',
];

const SKIP_DIRS = ['generated', 'vendor', 'node_modules', 'dist', 'data', 'ink', 'css', 'assets'];
const CACHE_DIR = '.lint-cache';

// Match: import ... from '...'
const IMPORT_PATTERN = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;

// Match: export ... from '...'
const REEXPORT_PATTERN = /export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g;

const args = process.argv.slice(2);
const outputJson = args.includes('--json');
const outputDot = args.includes('--dot');

/**
 * Recursively get all JS files
 */
function getJsFiles(dirs) {
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
 * Resolve import path to actual file path
 */
function resolveImportPath(importPath, sourceFile) {
  // Skip external packages
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
 * Extract all imports from a file
 */
function extractImports(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const imports = new Set();

  let match;

  // Find import statements
  const importRegex = new RegExp(IMPORT_PATTERN.source, 'g');
  while ((match = importRegex.exec(content)) !== null) {
    const resolved = resolveImportPath(match[1], filePath);
    if (resolved) {
      imports.add(resolved);
    }
  }

  // Find re-export statements
  const reexportRegex = new RegExp(REEXPORT_PATTERN.source, 'g');
  while ((match = reexportRegex.exec(content)) !== null) {
    const resolved = resolveImportPath(match[1], filePath);
    if (resolved) {
      imports.add(resolved);
    }
  }

  return [...imports];
}

/**
 * Build full dependency graph
 */
function buildGraph(files) {
  const graph = {};

  for (const file of files) {
    const relPath = relative(process.cwd(), file);
    // Filter out self-references (can happen with import patterns)
    const imports = extractImports(file)
      .map(f => relative(process.cwd(), f))
      .filter(f => f !== relPath);
    graph[relPath] = imports;
  }

  return graph;
}

/**
 * Find all cycles in the graph using DFS
 */
function findCycles(graph) {
  const cycles = [];
  const visited = new Set();
  const recursionStack = new Set();
  const path = [];

  function dfs(node) {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycle.push(neighbor); // Complete the cycle
        cycles.push(cycle);
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Output graph in DOT format
 */
function toDot(graph) {
  const lines = ['digraph imports {', '  rankdir=LR;', '  node [shape=box, fontsize=10];'];

  for (const [file, deps] of Object.entries(graph)) {
    const shortName = file.replace(/^src\//, '').replace(/\.js$/, '');
    for (const dep of deps) {
      const depShort = dep.replace(/^src\//, '').replace(/\.js$/, '');
      lines.push(`  "${shortName}" -> "${depShort}";`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

// Main
console.log('Building import dependency graph...\n');

const files = getJsFiles(SOURCE_DIRS);
const graph = buildGraph(files);

console.log(`Scanned ${files.length} files`);
console.log(`Found ${Object.values(graph).flat().length} import relationships\n`);

if (outputJson) {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
  const outPath = join(CACHE_DIR, 'import-graph.json');
  writeFileSync(outPath, JSON.stringify(graph, null, 2));
  console.log(`Graph written to ${outPath}`);
}

if (outputDot) {
  console.log(toDot(graph));
}

// Check for cycles
const cycles = findCycles(graph);

if (cycles.length === 0) {
  console.log('✓ No circular dependencies detected');
  process.exit(0);
} else {
  console.log('Circular dependencies found:\n');
  for (const cycle of cycles) {
    console.log('  ' + cycle.join(' → '));
    console.log();
  }
  console.log(`Found ${cycles.length} cycle(s)`);
  process.exit(1);
}
