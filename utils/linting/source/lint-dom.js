#!/usr/bin/env node
/**
 * lint-dom.js - Detect DOM mutations outside Web Components
 *
 * CQO-7: Shadow DOM / CSS Variables
 *
 * All DOM manipulation should happen inside Web Component shadow roots.
 * This prevents global DOM pollution and ensures encapsulation.
 *
 * Allowed:
 *   - main.js: Entry point that queries/initializes components
 *   - components/*.js: Inside shadow DOM (this.shadowRoot, this.shadow)
 *
 * Forbidden elsewhere:
 *   - document.querySelector/querySelectorAll/getElementById
 *   - appendChild/removeChild/insertBefore/replaceChild
 *   - innerHTML/outerHTML assignment
 *
 * Usage:
 *   node utils/linting/lint-dom.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show all files checked
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// 4-layer architecture directories
const JS_DIRS = [
  'packages/framework/src/foundation',
  'packages/framework/src/systems',
  'implementations',
];

// Files allowed to use document.querySelector (bootstrap only)
const BOOTSTRAP_FILES = ['main.js'];

// DOM mutation patterns
const DOM_QUERY_PATTERNS = [
  /document\s*\.\s*(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)/,
];

const DOM_MUTATION_PATTERNS = [
  /\.\s*(appendChild|removeChild|insertBefore|replaceChild)\s*\(/,
  /\.\s*innerHTML\s*=/,
  /\.\s*outerHTML\s*=/,
];

// Parse arguments
const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const showHelp = args.includes('-h') || args.includes('--help');

if (showHelp) {
  console.log(`
lint-dom.js - Detect DOM mutations outside Web Components

CQO-7: All DOM manipulation should happen inside Web Component shadow roots.

USAGE
  node utils/linting/lint-dom.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all files checked

ALLOWED PATTERNS
  main.js              Entry point can query components for initialization
  components/*.js      DOM ops allowed inside shadow DOM context:
                       - this.shadowRoot.innerHTML
                       - this.shadow.querySelector
                       - container.innerHTML (where container is in shadow)

FORBIDDEN (in non-component files)
  document.querySelector/querySelectorAll
  document.getElementById/getElementsByClassName
  el.appendChild/removeChild/insertBefore/replaceChild
  el.innerHTML = / el.outerHTML =

EXIT CODES
  0  No violations found
  1  DOM violations detected
`);
  process.exit(0);
}

const errors = [];
let filesChecked = 0;

/**
 * Check if line is inside shadow DOM context
 * @param {string} line - The line of code
 * @returns {boolean} - True if in shadow DOM context
 */
function isInShadowContext(line) {
  return (
    line.includes('shadowRoot') ||
    line.includes('this.shadow') ||
    line.includes('.shadow.')
  );
}

/**
 * Check a single file for DOM violations
 * @param {string} filePath - Path to JS file
 */
function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileName = filePath.split('/').pop();
  const isBootstrap = BOOTSTRAP_FILES.includes(fileName);
  const isComponent =
    filePath.includes('components/') ||
    content.includes('customElements.define');

  filesChecked++;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Check for document.querySelector patterns
    for (const pattern of DOM_QUERY_PATTERNS) {
      if (pattern.test(line)) {
        if (isBootstrap) {
          // Allowed in main.js
          if (verbose) console.log(`  [ok] ${filePath}:${lineNum} (bootstrap)`);
          continue;
        }
        if (isComponent && isInShadowContext(line)) {
          // Allowed in shadow context
          if (verbose)
            console.log(`  [ok] ${filePath}:${lineNum} (shadow DOM)`);
          continue;
        }
        errors.push(
          `CQO-7: ${relative(process.cwd(), filePath)}:${lineNum} - DOM query outside shadow context`,
        );
      }
    }

    // Check for DOM mutation patterns
    for (const pattern of DOM_MUTATION_PATTERNS) {
      if (pattern.test(line)) {
        if (isComponent && isInShadowContext(line)) {
          // Allowed in shadow context
          if (verbose)
            console.log(`  [ok] ${filePath}:${lineNum} (shadow DOM)`);
          continue;
        }
        // Components can mutate DOM inside their own structure
        if (isComponent) {
          // Allow mutations that reference internal elements (not document)
          if (!line.includes('document.') && !line.includes('document ')) {
            if (verbose)
              console.log(`  [ok] ${filePath}:${lineNum} (component internal)`);
            continue;
          }
        }
        errors.push(
          `CQO-7: ${relative(process.cwd(), filePath)}:${lineNum} - DOM mutation outside component`,
        );
      }
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
console.log(`Checking DOM usage in ${JS_DIRS.join(', ')}...`);
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
  console.error(`Found ${errors.length} CQO-7 violation(s)`);
  console.error(
    'DOM manipulation should happen inside Web Component shadow roots',
  );
  process.exit(1);
} else {
  console.log(`✓ CQO-7: No DOM mutations outside components`);
  if (verbose) console.log(`  Checked ${filesChecked} file(s)`);
  process.exit(0);
}
