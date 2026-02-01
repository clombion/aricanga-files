#!/usr/bin/env node
/**
 * lint-test-assumptions.js - Enforce test documentation for structural dependencies
 * CQO-23: Test Documentation (blocking)
 * CQO-24: Weak Assertion Detection (warning)
 *
 * Tests with structural dependencies must document INTENT and ASSUMPTION.
 * Tests with weak assertions are flagged for human review.
 *
 * Usage: node utils/linting/repo/lint-test-assumptions.js [--warnings]
 * Exit code: 0 if pass, 1 if blocking violations found
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// Monorepo test locations
// Start with test-utils (source code parsers) which caused the original failures
// Expand to all tests after task-92 adds docs to existing tests
const TEST_DIRS = [
  'packages/test-utils/src/helpers',  // Source code parsers - high risk
];

// Future expansion (task-92):
// const EXPANDED_TEST_DIRS = [
//   'tests',
//   'packages/framework/tests',
//   'packages/test-utils',
//   'experiences/aricanga/tests',
// ];

const args = process.argv.slice(2);
const showWarnings = args.includes('--warnings');
const verbose = args.includes('--verbose') || args.includes('-v');

// ============================================================================
// CQO-23: Test Documentation (Blocking)
// ============================================================================

// Patterns that require INTENT + ASSUMPTION documentation
// Only check at function/export declaration level, not every internal usage
const STRUCTURAL_PATTERNS = {
  // File reading in test helpers - only at declaration sites
  fileRead: /(?:readFileSync|fs\.read)\s*\(/,
  // Regex parsing of source code (only the definition, not exec/test calls)
  regexParse: /new\s+RegExp\s*\(/,
  // Test ordering assertions - only in test() or it() blocks
  testOrderingAssertion: /expect\([^)]*\[\s*0\s*\]\s*\)/,
};

// Required documentation markers
const INTENT_PATTERN = /\*\s*INTENT:|\/\/\s*INTENT:/i;
const ASSUMPTION_PATTERN = /\*\s*ASSUMPTION:|\/\/\s*ASSUMPTION:/i;

// ============================================================================
// CQO-24: Weak Assertion Detection (Warning)
// ============================================================================

// Weak assertion patterns that may mask failures
const WEAK_ASSERTIONS = {
  // .some() without strict checks
  someWithoutStrict: /expect\([^)]+\.some\([^)]+\)\)\.toBe\(true\)/,
  // .includes() for structural validation
  includesCheck: /expect\([^)]+\.includes\([^)]+\)\)\.toBe\(true\)/,
  // .find() where order might matter
  findCheck: /expect\([^)]+\.find\([^)]+\)\)/,
};

const blockingErrors = [];
const warnings = [];
let filesChecked = 0;

function findTestFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;

  function walk(d) {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;

      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.name.endsWith('.test.ts') ||
        entry.name.endsWith('.test.js') ||
        entry.name.endsWith('.spec.ts') ||
        entry.name.endsWith('.spec.js') ||
        // Also check test helper files
        (d.includes('test-utils') && entry.name.endsWith('.ts'))
      ) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Check if content has required documentation near the given line
 * Looks for docs in:
 * 1. The containing function's JSDoc
 * 2. The file-level module doc
 * 3. Within 20 lines above the pattern
 */
function hasRequiredDocs(lines, lineIndex) {
  // First, try to find containing function and check its doc
  let funcStartLine = -1;
  for (let i = lineIndex; i >= 0; i--) {
    const line = lines[i];
    // Look for function definition
    if (
      /^(?:export\s+)?(?:async\s+)?function\s+\w+/.test(line) ||
      /^const\s+\w+\s*=\s*(?:async\s+)?\(/.test(line) ||
      /^\s*\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/.test(line)
    ) {
      funcStartLine = i;
      break;
    }
  }

  // If we found a containing function, check its doc block (up to 15 lines before it)
  if (funcStartLine >= 0) {
    const funcDocStart = Math.max(0, funcStartLine - 15);
    const funcDocLines = lines.slice(funcDocStart, funcStartLine + 1).join('\n');
    const hasIntent = INTENT_PATTERN.test(funcDocLines);
    const hasAssumption = ASSUMPTION_PATTERN.test(funcDocLines);

    if (hasIntent && hasAssumption) {
      return { hasIntent: true, hasAssumption: true };
    }
  }

  // Also check file-level documentation (first 30 lines)
  const fileDocLines = lines.slice(0, Math.min(30, lines.length)).join('\n');
  const fileHasIntent = INTENT_PATTERN.test(fileDocLines);
  const fileHasAssumption = ASSUMPTION_PATTERN.test(fileDocLines);

  if (fileHasIntent && fileHasAssumption) {
    return { hasIntent: true, hasAssumption: true };
  }

  // Fall back to immediate context (20 lines)
  const startLine = Math.max(0, lineIndex - 20);
  const contextLines = lines.slice(startLine, lineIndex + 1).join('\n');

  return {
    hasIntent: INTENT_PATTERN.test(contextLines) || fileHasIntent,
    hasAssumption: ASSUMPTION_PATTERN.test(contextLines) || fileHasAssumption,
  };
}

/**
 * Get the containing function/test name for context
 */
function getContainingName(lines, lineIndex) {
  // Look backwards for function/test declaration
  for (let i = lineIndex; i >= 0; i--) {
    const line = lines[i];

    // Test declaration
    const testMatch = line.match(
      /(?:test|it|describe)\s*\(\s*['"`]([^'"`]+)['"`]/
    );
    if (testMatch) return `test: "${testMatch[1]}"`;

    // Function declaration
    const funcMatch = line.match(
      /(?:function|const|export\s+function)\s+(\w+)/
    );
    if (funcMatch) return `function: ${funcMatch[1]}`;
  }
  return 'unknown context';
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = relative(process.cwd(), filePath);

  filesChecked++;

  // Check for structural patterns requiring documentation (CQO-23)
  for (const [patternName, pattern] of Object.entries(STRUCTURAL_PATTERNS)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (pattern.test(line)) {
        const { hasIntent, hasAssumption } = hasRequiredDocs(lines, i);
        const context = getContainingName(lines, i);

        if (!hasIntent || !hasAssumption) {
          const missing = [];
          if (!hasIntent) missing.push('INTENT');
          if (!hasAssumption) missing.push('ASSUMPTION');

          blockingErrors.push({
            file: relativePath,
            line: i + 1,
            pattern: patternName,
            context,
            code: line.trim().substring(0, 60),
            missing,
          });
        }
      }
    }
  }

  // Check for weak assertions (CQO-24)
  if (showWarnings) {
    for (const [patternName, pattern] of Object.entries(WEAK_ASSERTIONS)) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (pattern.test(line)) {
          const context = getContainingName(lines, i);

          warnings.push({
            file: relativePath,
            line: i + 1,
            pattern: patternName,
            context,
            code: line.trim().substring(0, 60),
          });
        }
      }
    }
  }
}

console.log('CQO-23/24: Checking test assumptions...\n');

for (const dir of TEST_DIRS) {
  const files = findTestFiles(dir);
  for (const file of files) {
    checkFile(file);
  }
}

console.log(`Checked ${filesChecked} test file(s)\n`);

// Report blocking errors (CQO-23)
if (blockingErrors.length > 0) {
  console.error('CQO-23 violations (missing INTENT/ASSUMPTION docs):\n');
  for (const err of blockingErrors) {
    console.error(`  ${err.file}:${err.line}`);
    console.error(`    Pattern: ${err.pattern}`);
    console.error(`    Context: ${err.context}`);
    console.error(`    Code: ${err.code}`);
    console.error(`    Missing: ${err.missing.join(', ')}`);
    console.error('');
  }
  console.error(
    `Found ${blockingErrors.length} undocumented structural dependency(s)\n`
  );
  console.error('Fix by adding documentation like:');
  console.error('  /**');
  console.error('   * INTENT: What this test/helper is trying to verify');
  console.error('   * ASSUMPTION: What implementation detail it relies on');
  console.error('   * BREAKS if: Conditions that would invalidate this');
  console.error('   */\n');
}

// Report warnings (CQO-24)
if (showWarnings && warnings.length > 0) {
  console.warn('CQO-24 advisories (weak assertions for review):\n');
  for (const warn of warnings) {
    console.warn(`  ${warn.file}:${warn.line}`);
    console.warn(`    Pattern: ${warn.pattern}`);
    console.warn(`    Context: ${warn.context}`);
    console.warn(`    Code: ${warn.code}`);
    console.warn('');
  }
  console.warn(
    `Found ${warnings.length} weak assertion(s) - review if they could mask failures\n`
  );
}

// Exit status
if (blockingErrors.length > 0) {
  process.exit(1);
}

console.log('✓ CQO-23: All structural test dependencies documented');
if (showWarnings && warnings.length === 0) {
  console.log('✓ CQO-24: No weak assertions flagged');
}
process.exit(0);
