#!/usr/bin/env node
/**
 * lint-svg-a11y.js - Validate SVG accessibility attributes
 *
 * CQO-8: Accessibility
 *
 * All inline SVG elements must have proper accessibility attributes:
 * - aria-hidden="true" for decorative SVGs
 * - aria-label="..." for meaningful SVGs
 *
 * Usage:
 *   node utils/linting/source/lint-svg-a11y.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show all SVGs checked
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// 4-layer architecture directories
const JS_DIRS = [
  'packages/framework/src/foundation',
  'packages/framework/src/systems',
  'implementations',
];

// Parse arguments
const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const showHelp = args.includes('-h') || args.includes('--help');

if (showHelp) {
  console.log(`
lint-svg-a11y.js - Validate SVG accessibility attributes

CQO-8: All inline SVGs must have proper accessibility attributes.

USAGE
  node utils/linting/source/lint-svg-a11y.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all SVGs checked

REQUIREMENTS
  Every inline <svg> element must have ONE of:
  - aria-hidden="true"  For decorative SVGs (icons, visual flourishes)
  - aria-label="..."    For meaningful SVGs (charts, diagrams, logos)

EXAMPLES (valid)
  <svg aria-hidden="true">...</svg>
  <svg aria-label="Company logo">...</svg>
  <svg role="img" aria-label="Bar chart">...</svg>

EXAMPLES (invalid)
  <svg>...</svg>           Missing accessibility attribute
  <svg viewBox="...">      No aria-hidden or aria-label

EXIT CODES
  0  All SVGs have proper accessibility
  1  SVG accessibility violations found
`);
  process.exit(0);
}

const errors = [];
let svgsChecked = 0;

/**
 * Check a single file for SVG accessibility violations
 * @param {string} filePath - Path to JS file
 */
function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Find all inline SVG tags
  // Match <svg with optional attributes, handling multi-line definitions
  const svgPattern = /<svg\s[^>]*>/gi;
  let match;

  // Join lines for multi-line SVG detection
  const fullContent = content;

  while ((match = svgPattern.exec(fullContent)) !== null) {
    const svgTag = match[0];
    const position = match.index;

    // Calculate line number
    const beforeMatch = fullContent.substring(0, position);
    const lineNum = beforeMatch.split('\n').length;

    svgsChecked++;

    // Check for aria-hidden or aria-label
    const hasAriaHidden = /aria-hidden\s*=\s*["']true["']/i.test(svgTag);
    const hasAriaLabel = /aria-label\s*=\s*["'][^"']+["']/i.test(svgTag);

    if (hasAriaHidden || hasAriaLabel) {
      if (verbose) {
        const attrType = hasAriaHidden ? 'aria-hidden' : 'aria-label';
        console.log(`  [ok] ${relative(process.cwd(), filePath)}:${lineNum} (${attrType})`);
      }
    } else {
      errors.push(
        `CQO-8: ${relative(process.cwd(), filePath)}:${lineNum} - SVG missing aria-hidden or aria-label`
      );
    }
  }
}

const SKIP_DIRS = ['node_modules', 'vendor', 'dist', 'generated', 'data', 'ink', 'css', 'assets'];

/**
 * Recursively find all JS files
 * @param {string} dir - Directory to search
 * @returns {string[]} - Array of file paths
 */
function findJsFiles(dir) {
  const files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.includes(entry.name) || entry.name.startsWith('.')) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findJsFiles(fullPath));
      } else if (entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files;
}

// Find and check all JS files
console.log(`Checking SVG accessibility in ${JS_DIRS.join(', ')}...`);
if (verbose) console.log('');

const jsFiles = JS_DIRS.flatMap(dir => findJsFiles(dir));
for (const file of jsFiles) {
  checkFile(file);
}

// Summary
console.log('');
if (errors.length > 0) {
  console.error(errors.join('\n'));
  console.error('');
  console.error(`Found ${errors.length} CQO-8 SVG accessibility violation(s)`);
  console.error('Add aria-hidden="true" for decorative SVGs or aria-label="..." for meaningful ones');
  process.exit(1);
} else {
  console.log(`CQO-8: All inline SVGs have proper accessibility`);
  if (verbose) console.log(`  Checked ${svgsChecked} SVG(s)`);
  process.exit(0);
}
