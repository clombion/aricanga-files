#!/usr/bin/env node
/**
 * lint-current-chat.js - Ensure current_chat is set in ink chat knots
 * CQO-16: Chat routing relies on current_chat variable being set correctly
 *
 * Checks:
 * - Every chat knot (=== *_chat ===) must set current_chat
 * - current_chat value should match the knot prefix (pat_chat -> "pat")
 *
 * USAGE
 *   node utils/linting/ink/lint-current-chat.js [options]
 *
 * OPTIONS
 *   --help, -h     Show help
 *   --verbose, -v  Show all files checked
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// Dynamically discover all implementation ink directories
function getInkDirs() {
  const implRoot = 'implementations';
  if (!existsSync(implRoot)) return [];

  const dirs = [];
  const impls = readdirSync(implRoot, { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  );

  for (const impl of impls) {
    const inkDir = join(implRoot, impl.name, 'ink');
    if (existsSync(inkDir)) {
      dirs.push(inkDir);
    }
  }

  return dirs;
}

const INK_DIRS = getInkDirs();

const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const showHelp = args.includes('-h') || args.includes('--help');

if (showHelp) {
  console.log(`
lint-current-chat.js - Ensure current_chat is set in ink chat knots

CQO-16: Chat routing relies on current_chat variable being set correctly.
Messages will appear in wrong threads if current_chat is not set.

USAGE
  node utils/linting/ink/lint-current-chat.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all files checked

CHECKS
  • Every chat knot (=== *_chat ===) must set current_chat
  • current_chat value should match the knot prefix

VALID PATTERN
  === pat_chat ===
  ~ current_chat = "pat"
  ...

INVALID PATTERNS
  === pat_chat ===
  // Missing: ~ current_chat = "pat"
  ...

  === pat_chat ===
  ~ current_chat = "news"  // Mismatch: should be "pat"
  ...

EXIT CODES
  0  No violations found
  1  Missing or mismatched current_chat found
`);
  process.exit(0);
}

const errors = [];
const warnings = [];
let filesChecked = 0;

function findInkFiles(dir) {
  const files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findInkFiles(fullPath));
      } else if (entry.name.endsWith('.ink')) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = relative(process.cwd(), filePath);

  // Skip files that don't have chat knots
  if (!content.includes('_chat')) {
    if (verbose) console.log(`  [skip] ${relativePath} (no chat knots)`);
    return;
  }

  filesChecked++;

  // Find all chat knots and check for current_chat
  const knotPattern = /^===\s*(\w+)_chat\s*===/;
  const currentChatPattern = /^~\s*current_chat\s*=\s*["'](\w+)["']/;

  let currentKnot = null;
  let knotLine = 0;
  let foundCurrentChat = false;
  let linesAfterKnot = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Check for new knot
    const knotMatch = trimmed.match(knotPattern);
    if (knotMatch) {
      // If we had a previous knot without current_chat, report it
      if (currentKnot && !foundCurrentChat) {
        errors.push({
          file: relativePath,
          line: knotLine,
          knot: currentKnot,
          message: `Chat knot "${currentKnot}_chat" missing "~ current_chat = \\"${currentKnot}\\""`,
        });
      }

      currentKnot = knotMatch[1];
      knotLine = lineNum;
      foundCurrentChat = false;
      linesAfterKnot = 0;
      continue;
    }

    // Count lines after knot declaration
    if (currentKnot && trimmed) {
      linesAfterKnot++;
    }

    // Check for current_chat assignment
    const chatMatch = trimmed.match(currentChatPattern);
    if (chatMatch && currentKnot) {
      const setChatId = chatMatch[1];
      foundCurrentChat = true;

      // Warn if set more than 5 lines after knot
      if (linesAfterKnot > 5) {
        warnings.push({
          file: relativePath,
          line: lineNum,
          knot: currentKnot,
          message: `current_chat set ${linesAfterKnot} lines after knot declaration (prefer immediately after)`,
        });
      }

      // Check if chat ID matches knot prefix
      if (setChatId !== currentKnot) {
        errors.push({
          file: relativePath,
          line: lineNum,
          knot: currentKnot,
          message: `current_chat mismatch: knot is "${currentKnot}_chat" but current_chat set to "${setChatId}"`,
        });
      }
    }

    // Check for sub-knot (= name) which would reset our tracking
    if (trimmed.startsWith('= ') && !trimmed.startsWith('===')) {
      // Don't require current_chat in sub-knots (stitches)
      // They inherit from the parent knot
      currentKnot = null;
    }
  }

  // Check final knot
  if (currentKnot && !foundCurrentChat) {
    errors.push({
      file: relativePath,
      line: knotLine,
      knot: currentKnot,
      message: `Chat knot "${currentKnot}_chat" missing "~ current_chat = \\"${currentKnot}\\""`,
    });
  }
}

console.log(`Checking current_chat in ${INK_DIRS.join(', ')}...`);
if (verbose) console.log('');

const inkFiles = INK_DIRS.flatMap((dir) => findInkFiles(dir));
for (const file of inkFiles) {
  checkFile(file);
}

console.log('');
if (errors.length > 0) {
  console.error('CQO-16 violations found:\n');
  for (const err of errors) {
    console.error(`  ${err.file}:${err.line}`);
    console.error(`    ${err.message}`);
    console.error('');
  }
  console.error(`Found ${errors.length} current_chat error(s)`);

  if (warnings.length > 0 && verbose) {
    console.warn(`\nWarnings (${warnings.length}):`);
    for (const warn of warnings) {
      console.warn(`  ${warn.file}:${warn.line}`);
      console.warn(`    ${warn.message}`);
    }
  }

  console.error('');
  console.error('To fix:');
  console.error(
    '  Add "~ current_chat = \\"chatname\\"" immediately after each chat knot:',
  );
  console.error('');
  console.error('  === pat_chat ===');
  console.error('  ~ current_chat = "pat"');
  console.error('  ...');
  process.exit(1);
} else {
  console.log(`✓ CQO-16: All chat knots set current_chat correctly`);
  if (verbose) console.log(`  Checked ${filesChecked} file(s)`);

  if (warnings.length > 0 && verbose) {
    console.warn(`\n${warnings.length} warning(s):`);
    for (const warn of warnings) {
      console.warn(`  ${warn.file}:${warn.line}: ${warn.message}`);
    }
  }

  process.exit(0);
}
