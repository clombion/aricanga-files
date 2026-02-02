#!/usr/bin/env node
/**
 * lint-transition-safety.js - Detect layout-forcing ops in component show() methods
 *
 * Prevents layout thrash during view transitions (BUG-012 pattern).
 * transitionViews() owns element visibility — components should use
 * onReady/onComplete callbacks instead of setting hidden or scrolling directly.
 *
 * Rule 1: Flag `this.hidden = false` inside show() methods in components.
 *         Visibility is owned by transitionViews().
 *
 * Rule 2: Flag scrollIntoView calls that aren't deferred (not inside
 *         setTimeout, .then(), or a method designed to be called post-transition).
 *
 * Usage:
 *   node utils/linting/source/lint-transition-safety.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show all files checked
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const COMPONENT_DIRS = [
  'packages/framework/src/systems/conversation/components',
  'experiences/aricanga/src/components',
];

const SKIP_DIRS = [
  'node_modules',
  'vendor',
  'dist',
  'generated',
  'data',
  'ink',
];

const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const showHelp = args.includes('-h') || args.includes('--help');

if (showHelp) {
  console.log(`
lint-transition-safety.js - Detect layout-forcing ops in component show() methods

Prevents layout thrash during view transitions (BUG-012 pattern).

USAGE
  node utils/linting/source/lint-transition-safety.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all files checked

RULES
  1. Components must not set this.hidden = false in show() methods.
     Visibility is owned by transitionViews() — use onReady callback.

  2. scrollIntoView calls in show() methods must be deferred.
     Use onComplete callback or a separate method called post-transition.

EXIT CODES
  0  No violations found
  1  Violations detected
`);
  process.exit(0);
}

const errors = [];
let filesChecked = 0;

/**
 * Check if we're inside a show() or similar method that prepares content.
 * Uses a simple brace-depth tracker from the method declaration.
 */
function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  filesChecked++;

  let inShowMethod = false;
  let braceDepth = 0;
  let showMethodStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Detect show() method declarations (async show, show(, etc.)
    if (
      /^\s*(async\s+)?show\s*\(/.test(line) &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('*')
    ) {
      inShowMethod = true;
      braceDepth = 0;
      showMethodStartLine = lineNum;
    }

    // Track brace depth to know when we leave the method
    if (inShowMethod) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }

      // Rule 1: this.hidden = false inside show()
      // Components that toggle visibility directly (not via transitionViews)
      // can opt out with: // lint-ignore: direct visibility
      if (/this\.hidden\s*=\s*false/.test(line) && !line.includes('lint-ignore')) {
        errors.push(
          `${relative(process.cwd(), filePath)}:${lineNum} - ` +
            `this.hidden = false in show() method. ` +
            `Visibility is owned by transitionViews() — remove this line ` +
            `and let the transition system handle it via onReady callback.`,
        );
      }

      // Rule 2: scrollIntoView inside show() (not deferred)
      if (/scrollIntoView/.test(line) && !line.includes('lint-ignore')) {
        errors.push(
          `${relative(process.cwd(), filePath)}:${lineNum} - ` +
            `scrollIntoView in show() method. ` +
            `Move to a separate method and call via onComplete callback ` +
            `to avoid layout thrash during transitions.`,
        );
      }

      // Left the method
      if (braceDepth <= 0 && showMethodStartLine !== lineNum) {
        inShowMethod = false;
      }
    }
  }
}

function findJsFiles(dir) {
  const files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.includes(entry.name) || entry.name.startsWith('.'))
        continue;
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

// Find and check all component JS files
console.log(
  `Checking transition safety in ${COMPONENT_DIRS.join(', ')}...`,
);
if (verbose) console.log('');

const jsFiles = COMPONENT_DIRS.flatMap((dir) => findJsFiles(dir));
for (const file of jsFiles) {
  checkFile(file);
  if (verbose) console.log(`  checked ${relative(process.cwd(), file)}`);
}

// Summary
console.log('');
if (errors.length > 0) {
  console.error(errors.join('\n'));
  console.error('');
  console.error(`Found ${errors.length} transition safety violation(s)`);
  console.error(
    'Components must not set visibility or scroll in show() methods.',
  );
  console.error(
    'Use transitionViews() onReady/onComplete callbacks instead.',
  );
  process.exit(1);
} else {
  console.log(
    `✓ Transition safety: No layout-forcing ops in component show() methods`,
  );
  if (verbose) console.log(`  Checked ${filesChecked} file(s)`);
  process.exit(0);
}
