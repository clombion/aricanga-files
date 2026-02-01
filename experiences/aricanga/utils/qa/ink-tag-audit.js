#!/usr/bin/env node

/**
 * Ink Tag Audit - Validates tag hygiene using compiled story JSON
 *
 * Uses inkjs TagsForContentAtPath() to check compiled story tags,
 * catching issues that source-based linting misses (conditional tags,
 * included files, tag ordering).
 *
 * Usage:
 *   node utils/qa/ink-tag-audit.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show all paths checked, not just issues
 *   --locale=XX    Use specific locale (default: from config)
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Issues found or story load failed
 */

import { readdirSync, readFileSync } from 'fs';
import { Story } from 'inkjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getLocale, getLocalePaths } from '../../../../utils/lib/locale-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

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
ink-tag-audit.js - Validate tag hygiene in compiled story

USAGE
  node utils/qa/ink-tag-audit.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all paths checked, not just issues
  --locale=XX    Use specific locale (default: from config)

CHECKS PERFORMED
  1. Speaker at entry - Chat knots must have speaker tag
  2. Orphan time tags - time: without speaker: is suspicious
  3. story_start boundaries - Only at expected locations
  4. Delay without speaker - delay: should accompany a speaker

HOW IT WORKS
  Uses inkjs TagsForContentAtPath() to read tags from the compiled
  story JSON. This catches issues that source-based linting misses:
  - Conditional tags (runtime-only)
  - Tags in included files
  - Tag ordering across stitches

OUTPUT
  Lists issues found with path and description.
  Exit code 0 if clean, 1 if issues found.

EXAMPLES
  node utils/qa/ink-tag-audit.js              # Run audit
  node utils/qa/ink-tag-audit.js -v           # Verbose output
  node utils/qa/ink-tag-audit.js --locale=fr  # Audit French locale
`);
  process.exit(0);
}

// Show help if requested
if (ARGS.help) {
  showHelp();
}

const locale = getLocale();
const localePaths = getLocalePaths(locale);

const CONFIG = {
  storyPath: localePaths.storyPath,
  inkDir: localePaths.inkDir,
  // Knots that should have speaker tags at entry
  chatKnots: [
    'news_chat',
    'pat_chat',
    'notes_chat',
    'spectre_chat',
    'activist_chat',
  ],
};

/**
 * Extract all knot and stitch paths from ink source files
 * @param {string} inkDir - Path to ink source directory
 * @returns {Array<{path: string, file: string}>} All paths found
 */
function extractPaths(inkDir) {
  const paths = [];
  const files = readdirSync(inkDir).filter((f) => f.endsWith('.ink'));

  for (const file of files) {
    const content = readFileSync(join(inkDir, file), 'utf-8');
    const lines = content.split('\n');
    let currentKnot = null;

    for (const line of lines) {
      const knotMatch = line.match(/^===\s*(\w+)\s*===/);
      if (knotMatch) {
        currentKnot = knotMatch[1];
        paths.push({ path: currentKnot, file });
        continue;
      }

      const stitchMatch = line.match(/^=\s*(\w+)\s*$/);
      if (stitchMatch && currentKnot) {
        paths.push({ path: `${currentKnot}.${stitchMatch[1]}`, file });
      }
    }
  }

  return paths;
}

/**
 * Parse tag string into key-value pairs
 * @param {string} tag - Tag like "speaker:Pat" or "time:9:00 AM"
 * @returns {{key: string, value: string}|null}
 */
function parseTag(tag) {
  const colonIndex = tag.indexOf(':');
  if (colonIndex === -1) {
    return { key: tag, value: '' };
  }
  return {
    key: tag.substring(0, colonIndex),
    value: tag.substring(colonIndex + 1),
  };
}

/**
 * Check if tags array contains a specific key
 * @param {Array<string>|null} tags - Tags from TagsForContentAtPath
 * @param {string} key - Tag key to look for
 * @returns {boolean}
 */
function hasTag(tags, key) {
  if (!tags) return false;
  return tags.some((t) => {
    const parsed = parseTag(t);
    return parsed && parsed.key === key;
  });
}

/**
 * Get tag value if present
 * @param {Array<string>|null} tags - Tags from TagsForContentAtPath
 * @param {string} key - Tag key to look for
 * @returns {string|null}
 */
function getTagValue(tags, key) {
  if (!tags) return null;
  for (const t of tags) {
    const parsed = parseTag(t);
    if (parsed && parsed.key === key) {
      return parsed.value;
    }
  }
  return null;
}

/**
 * Run all tag audit checks
 * @param {Object} story - inkjs Story instance
 * @param {Array} allPaths - All paths to check
 * @returns {Array<{path: string, issue: string, severity: string}>}
 */
function runAudit(story, allPaths) {
  const issues = [];

  for (const { path, file } of allPaths) {
    let tags;
    try {
      tags = story.TagsForContentAtPath(path);
    } catch (_e) {
      // Path not found in compiled story (might be dead code)
      continue;
    }

    if (!tags || tags.length === 0) {
      // No tags at this path, nothing to check
      if (ARGS.verbose) {
        console.log(`  [skip] ${path}: no tags`);
      }
      continue;
    }

    if (ARGS.verbose) {
      console.log(`  [check] ${path}: ${tags.join(', ')}`);
    }

    // Check 1: Chat entry points should have speaker tag
    const isChatEntry = CONFIG.chatKnots.includes(path);
    if (isChatEntry && !hasTag(tags, 'speaker')) {
      issues.push({
        path,
        file,
        issue: 'Chat entry missing speaker tag',
        severity: 'warning',
        tags,
      });
    }

    // Check 2: Orphan time tags (time without speaker)
    // A time tag without a speaker is suspicious - who's message is this?
    if (hasTag(tags, 'time') && !hasTag(tags, 'speaker') && !hasTag(tags, 'type')) {
      issues.push({
        path,
        file,
        issue: 'time: tag without speaker: or type: (orphan time?)',
        severity: 'warning',
        tags,
      });
    }

    // Check 3: story_start should only appear at expected boundaries
    // Typically at the first real message after seed content
    if (hasTag(tags, 'story_start')) {
      // story_start at a knot entry (not stitch) is unusual
      if (!path.includes('.')) {
        issues.push({
          path,
          file,
          issue: 'story_start at knot entry (expected in stitch)',
          severity: 'info',
          tags,
        });
      }
    }

    // Check 4: delay without message context
    // Delay should accompany speaker/type for typing indicators
    if (hasTag(tags, 'delay') && !hasTag(tags, 'speaker') && !hasTag(tags, 'type')) {
      issues.push({
        path,
        file,
        issue: 'delay: tag without speaker:/type: context',
        severity: 'info',
        tags,
      });
    }
  }

  return issues;
}

/**
 * Main entry point
 */
async function main() {
  console.log(`=== Compiled Tag Audit (locale: ${locale}) ===\n`);

  // Load compiled story
  console.log('Loading compiled story...');
  if (ARGS.verbose) console.log(`  Path: ${CONFIG.storyPath}`);

  let storyJson;
  try {
    const storyContent = readFileSync(CONFIG.storyPath, 'utf-8');
    storyJson = JSON.parse(storyContent);
  } catch (error) {
    console.error(`Failed to load story: ${error.message}`);
    console.error('Run "mise run build" first.');
    process.exit(1);
  }

  // Create story instance (no external functions needed for tag reading)
  const story = new Story(storyJson);

  // Extract paths from source files
  console.log('Extracting paths from ink source...');
  if (ARGS.verbose) console.log(`  Ink dir: ${CONFIG.inkDir}`);
  const allPaths = extractPaths(CONFIG.inkDir);
  console.log(`  Found ${allPaths.length} paths\n`);

  // Run audit
  console.log('Checking tag hygiene...');
  const issues = runAudit(story, allPaths);

  // Report results
  console.log('\n=== Audit Results ===\n');

  if (issues.length === 0) {
    console.log('All checks passed.\n');
    process.exit(0);
  }

  // Group by severity
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):`);
    for (const issue of warnings) {
      console.log(`  ${issue.path} (${issue.file})`);
      console.log(`    ${issue.issue}`);
      console.log(`    Tags: ${issue.tags.join(', ')}`);
    }
    console.log('');
  }

  if (infos.length > 0) {
    console.log(`Info (${infos.length}):`);
    for (const issue of infos) {
      console.log(`  ${issue.path} (${issue.file})`);
      console.log(`    ${issue.issue}`);
    }
    console.log('');
  }

  console.log(`Total issues: ${issues.length} (${warnings.length} warnings, ${infos.length} info)\n`);

  // Exit with error if warnings found
  if (warnings.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
