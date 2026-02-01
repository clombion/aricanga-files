#!/usr/bin/env node

/**
 * lint-time-tags.js - Validate time tag progression in ink files
 *
 * CQO-13: Time Coherence
 *
 * Checks that time tags (# time:) in ink files progress forward within
 * each stitch. Time tags before # story_start are seed values and
 * don't need to progress.
 *
 * Rules:
 * 1. Time tags AFTER # story_start within a stitch must progress forward
 * 2. Time tags BEFORE # story_start are display-only (seeds) and don't need to progress
 * 3. Main knot (=== name ===) counts as a stitch
 *
 * Usage:
 *   node utils/linting/ink/lint-time-tags.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show all time tags found
 *
 * Exit codes:
 *   0 - All time tags valid
 *   1 - Violations found
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PROJECT_ROOT,
  findInkFiles,
  getImplementations,
  getInkLocaleDirectories,
  relativePath,
} from '../../../../utils/linting/lib/ink-utils.js';

// Parse CLI arguments
const ARGS = {
  help: process.argv.includes('--help') || process.argv.includes('-h'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
};

/**
 * Print help message and exit
 */
function showHelp() {
  console.log(`
lint-time-tags.js - Validate time tag progression in ink files

USAGE
  node utils/linting/ink/lint-time-tags.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all time tags found

CHECKS
  • Time tags progress forward within each stitch (after # story_start)
  • Seed time tags (before # story_start) are allowed to be any value

WHY THIS MATTERS
  Time coherence (CQO-13) ensures the narrative timeline makes sense.
  Backward time jumps within a stitch break immersion.

EXIT CODES
  0  All time tags valid
  1  Violations found

EXAMPLES
  node utils/linting/ink/lint-time-tags.js         # Quick lint
  node utils/linting/ink/lint-time-tags.js -v      # Verbose with all tags
`);
  process.exit(0);
}

/**
 * Parse time string to minutes since midnight for comparison
 */
function parseTimeToMinutes(timeStr) {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return -1;
  let [, hours, minutes, period] = match;
  let h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  if (period) {
    period = period.toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
  }
  return h * 60 + m;
}

/**
 * Analyze ink file for time tag violations
 */
function analyzeInkFile(filePath, fileName) {
  const violations = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let currentStitch = 'top';
  let stitchStartLine = 0;
  let stitchTimeTags = [];
  let storyStarted = false;

  const flushStitch = () => {
    if (stitchTimeTags.length > 1) {
      // Check that multiple time tags progress forward (no backward jumps)
      for (let i = 1; i < stitchTimeTags.length; i++) {
        const prevMinutes = parseTimeToMinutes(stitchTimeTags[i - 1].tag);
        const currMinutes = parseTimeToMinutes(stitchTimeTags[i].tag);
        if (currMinutes !== -1 && prevMinutes !== -1 && currMinutes <= prevMinutes) {
          violations.push({
            file: fileName,
            stitch: currentStitch,
            line: stitchTimeTags[i].line,
            message: `Backward time in stitch "${currentStitch}". "${stitchTimeTags[i].tag}" <= "${stitchTimeTags[i - 1].tag}"`,
          });
        }
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Detect knot (=== name ===)
    const knotMatch = line.match(/^===\s*(\w+)\s*===/);
    if (knotMatch) {
      flushStitch();
      currentStitch = knotMatch[1];
      stitchStartLine = lineNum;
      stitchTimeTags = [];
      storyStarted = false;
      continue;
    }

    // Detect stitch (= name)
    const stitchMatch = line.match(/^=\s*(\w+)\s*$/);
    if (stitchMatch) {
      flushStitch();
      currentStitch = stitchMatch[1];
      stitchStartLine = lineNum;
      stitchTimeTags = [];
      continue;
    }

    // Detect # story_start marker
    if (line.match(/#\s*story_start/)) {
      storyStarted = true;
      continue;
    }

    // Detect time tag - only track if story has started
    const timeMatch = line.match(/#\s*time:\s*(.+)/);
    if (timeMatch && storyStarted) {
      const tag = timeMatch[1].trim();
      stitchTimeTags.push({ line: lineNum, tag });
      if (ARGS.verbose) {
        console.log(`  ${fileName}:${lineNum} - ${currentStitch}: # time:${tag}`);
      }
    }
  }

  // Flush last stitch
  flushStitch();

  return violations;
}

/**
 * Get all ink directories from implementations
 */
function getInkDirectories() {
  const dirs = [];
  const impls = getImplementations();

  for (const impl of impls) {
    const localeDirs = getInkLocaleDirectories(impl.path);
    for (const { locale, path } of localeDirs) {
      dirs.push({
        impl: impl.name,
        locale,
        path,
      });
    }
  }

  return dirs;
}

/**
 * Main entry point
 */
function main() {
  if (ARGS.help) {
    showHelp();
  }

  console.log('Linting time tags...\n');

  const inkDirs = getInkDirectories();

  if (inkDirs.length === 0) {
    console.log('No ink directories found.');
    process.exit(0);
  }

  let totalViolations = 0;
  let totalFiles = 0;

  for (const { impl, locale, path: inkDir } of inkDirs) {
    if (ARGS.verbose) {
      console.log(`Scanning ${impl}/${locale}...`);
    }

    const inkFiles = findInkFiles(inkDir);

    for (const filePath of inkFiles) {
      const relPath = relativePath(filePath, inkDir);
      const violations = analyzeInkFile(filePath, `${impl}/ink/${locale}/${relPath}`);

      if (violations.length > 0) {
        for (const v of violations) {
          console.log(`ERROR: ${v.file}:${v.line} (${v.stitch}): ${v.message}`);
        }
        totalViolations += violations.length;
      }

      totalFiles++;
    }
  }

  // Summary
  console.log('');
  if (totalViolations > 0) {
    console.log(`Found ${totalViolations} time tag violation(s) in ${totalFiles} file(s).`);
    process.exit(1);
  } else {
    console.log(`All time tags valid (${totalFiles} file(s) checked).`);
    process.exit(0);
  }
}

main();
