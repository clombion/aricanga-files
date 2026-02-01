#!/usr/bin/env node
/**
 * lint-html-imports.js - Verify HTML entry points can resolve dependencies
 *
 * Parses index.html files for <script src="..."> and <link href="..."> tags
 * and verifies each path resolves to an actual file.
 *
 * Note: Run on source HTML only, NOT on dist/ which contains Vite-transformed output.
 *
 * Usage: node utils/linting/repo/lint-html-imports.js
 * Exit code: 0 if all imports resolve, 1 if broken imports found
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

// HTML files to check
const HTML_PATTERNS = [
  'experiences/*/index.html',
];

// Patterns to match script/link tags
const SCRIPT_PATTERN = /<script[^>]+src=["']([^"']+)["']/g;
const LINK_PATTERN = /<link[^>]+href=["']([^"']+)["']/g;
const MODULE_PATTERN = /<script[^>]+type=["']module["'][^>]*>/;

/**
 * Glob-style pattern matching for finding HTML files
 */
function findHtmlFiles(pattern) {
  const parts = pattern.split('/');
  const files = [];

  function walk(dir, partIndex) {
    if (!existsSync(dir)) return;

    if (partIndex >= parts.length) {
      // We've matched all parts
      if (dir.endsWith('.html') && existsSync(dir)) {
        files.push(dir);
      }
      return;
    }

    const part = parts[partIndex];

    if (part === '*') {
      // Wildcard: match any directory
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          walk(join(dir, entry.name), partIndex + 1);
        }
      }
    } else {
      // Literal: match exact name
      const nextPath = join(dir, part);
      if (existsSync(nextPath)) {
        if (part.endsWith('.html')) {
          files.push(nextPath);
        } else {
          walk(nextPath, partIndex + 1);
        }
      }
    }
  }

  walk('.', 0);
  return files;
}

/**
 * Check if a path should be checked (skip URLs, data URIs, etc.)
 */
function shouldCheck(path) {
  // Skip URLs
  if (/^(https?:|\/\/|data:|#)/.test(path)) return false;
  // Skip empty or anchor-only
  if (!path || path.startsWith('#')) return false;
  return true;
}

/**
 * Resolve a path relative to the HTML file
 */
function resolvePath(importPath, htmlFile) {
  const htmlDir = dirname(htmlFile);
  return resolve(htmlDir, importPath);
}

/**
 * Extract all script and link imports from HTML
 */
function extractImports(htmlFile) {
  const content = readFileSync(htmlFile, 'utf-8');
  const imports = [];

  let match;

  // Script src
  const scriptRegex = new RegExp(SCRIPT_PATTERN.source, 'g');
  while ((match = scriptRegex.exec(content)) !== null) {
    if (shouldCheck(match[1])) {
      imports.push({
        type: 'script',
        path: match[1],
        line: content.substring(0, match.index).split('\n').length,
      });
    }
  }

  // Link href (stylesheets)
  const linkRegex = new RegExp(LINK_PATTERN.source, 'g');
  while ((match = linkRegex.exec(content)) !== null) {
    // Only check stylesheet links
    const fullTag = content.substring(match.index, match.index + 200);
    if (fullTag.includes('stylesheet') && shouldCheck(match[1])) {
      imports.push({
        type: 'stylesheet',
        path: match[1],
        line: content.substring(0, match.index).split('\n').length,
      });
    }
  }

  return imports;
}

// Main
console.log('Checking HTML import paths...\n');

// Find all HTML files
const htmlFiles = [];
for (const pattern of HTML_PATTERNS) {
  htmlFiles.push(...findHtmlFiles(pattern));
}

if (htmlFiles.length === 0) {
  console.log('No HTML files found matching patterns:');
  for (const p of HTML_PATTERNS) {
    console.log(`  ${p}`);
  }
  process.exit(0);
}

const violations = [];

for (const htmlFile of htmlFiles) {
  const imports = extractImports(htmlFile);

  for (const imp of imports) {
    const resolved = resolvePath(imp.path, htmlFile);

    if (!existsSync(resolved)) {
      violations.push({
        file: htmlFile,
        line: imp.line,
        type: imp.type,
        path: imp.path,
        resolved,
      });
    }
  }
}

console.log(`Checked ${htmlFiles.length} HTML file(s)`);

if (violations.length === 0) {
  console.log('✓ All HTML imports resolve to existing files');
  process.exit(0);
} else {
  console.log('\nBroken HTML imports found:\n');
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    <${v.type}> ${v.path}`);
    console.log(`    Resolved: ${v.resolved}`);
    console.log();
  }
  console.log(`Found ${violations.length} broken import(s)`);
  process.exit(1);
}
