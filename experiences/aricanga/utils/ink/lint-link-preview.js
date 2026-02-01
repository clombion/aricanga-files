#!/usr/bin/env node

/**
 * lint-link-preview.js - Validate link preview tag dependencies
 *
 * Checks that link preview tags have valid references:
 * - glossary:xxx URLs reference terms in glossary-terms.toml
 * - linkImage paths reference existing asset files
 * - card/inline layouts with missing images get warnings
 *
 * Usage:
 *   node utils/ink/lint-link-preview.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show detailed validation info
 *
 * Exit codes:
 *   0 - All link previews valid
 *   1 - Validation errors found
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { getPaths, getProjectRoot } from '../../../../utils/lib/locale-config.js';

const PROJECT_ROOT = getProjectRoot();

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
lint-link-preview.js - Validate link preview tag dependencies

USAGE
  node utils/ink/lint-link-preview.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show detailed validation info

CHECKS
  LINK-1: glossary:xxx URLs reference terms in glossary-terms.toml (ERROR)
  LINK-2: linkImage paths reference existing asset files (ERROR)
  LINK-3: card layout without linkImage (WARNING)
  LINK-4: inline layout without linkImage (WARNING)

EXIT CODES
  0  All link previews valid
  1  Validation errors found

EXAMPLES
  node utils/ink/lint-link-preview.js         # Quick lint
  node utils/ink/lint-link-preview.js -v      # Verbose output
`);
  process.exit(0);
}

/**
 * Parse glossary-terms.toml to extract term IDs
 * @param {string} content - TOML file content
 * @returns {Set<string>} Set of term IDs
 */
function parseGlossaryTerms(content) {
  const ids = new Set();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    const idMatch = trimmed.match(/^id\s*=\s*"([^"]+)"/);
    if (idMatch) {
      ids.add(idMatch[1]);
    }
  }

  return ids;
}

/**
 * Find all ink files recursively
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of ink file paths
 */
function findInkFiles(dir) {
  const files = [];

  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findInkFiles(fullPath));
    } else if (entry.name.endsWith('.ink')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract link preview tag groups from ink file
 * @param {string} content - Ink file content
 * @param {string} filePath - Path to file (for error messages)
 * @returns {Array<{line: number, tags: Object}>} Array of tag groups
 */
function extractLinkPreviews(content, filePath) {
  const previews = [];
  const lines = content.split('\n');

  let currentTags = {};
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match link preview tags
    const linkUrlMatch = line.match(/^#\s*linkUrl:(.+)$/);
    const linkImageMatch = line.match(/^#\s*linkImage:(.+)$/);
    const linkLayoutMatch = line.match(/^#\s*linkLayout:(.+)$/);
    const linkDomainMatch = line.match(/^#\s*linkDomain:(.+)$/);
    const linkTitleMatch = line.match(/^#\s*linkTitle:(.+)$/);
    const linkDescMatch = line.match(/^#\s*linkDesc:(.+)$/);

    if (linkUrlMatch) {
      currentTags = { linkUrl: linkUrlMatch[1].trim() };
      startLine = i + 1;
    }
    if (linkImageMatch) currentTags.linkImage = linkImageMatch[1].trim();
    if (linkLayoutMatch) currentTags.linkLayout = linkLayoutMatch[1].trim();
    if (linkDomainMatch) currentTags.linkDomain = linkDomainMatch[1].trim();
    if (linkTitleMatch) currentTags.linkTitle = linkTitleMatch[1].trim();
    if (linkDescMatch) currentTags.linkDesc = linkDescMatch[1].trim();

    // When we hit a non-tag line (content), save the group if it has linkUrl
    if (!line.startsWith('#') && !line.startsWith('~') && line.length > 0 && currentTags.linkUrl) {
      previews.push({ line: startLine, tags: { ...currentTags } });
      currentTags = {};
    }
  }

  return previews;
}

/**
 * Lint link previews in a single implementation
 * @param {string} implName - Implementation name
 * @returns {{errors: string[], warnings: string[]}}
 */
function lintImplementation(implName) {
  const errors = [];
  const warnings = [];
  const paths = getPaths(implName);

  const glossaryPath = join(paths.dataDir, 'glossary-terms.toml');
  const assetsDir = join(PROJECT_ROOT, 'experiences', implName, 'assets');
  const inkDir = paths.inkDir;

  // Load glossary terms if available
  let glossaryTerms = new Set();
  if (existsSync(glossaryPath)) {
    const content = readFileSync(glossaryPath, 'utf-8');
    glossaryTerms = parseGlossaryTerms(content);
    if (ARGS.verbose) {
      console.log(`  Loaded ${glossaryTerms.size} glossary terms`);
    }
  }

  // Find all ink files
  const inkFiles = findInkFiles(inkDir);
  if (ARGS.verbose) {
    console.log(`  Found ${inkFiles.length} ink files`);
  }

  let previewCount = 0;

  for (const inkFile of inkFiles) {
    const content = readFileSync(inkFile, 'utf-8');
    const previews = extractLinkPreviews(content, inkFile);

    const relativePath = inkFile.replace(PROJECT_ROOT + '/', '');

    for (const { line, tags } of previews) {
      previewCount++;

      // LINK-1: Check glossary:xxx URLs
      if (tags.linkUrl && tags.linkUrl.startsWith('glossary:')) {
        const termId = tags.linkUrl.replace('glossary:', '');
        if (!glossaryTerms.has(termId)) {
          errors.push(
            `LINK-1: ${relativePath}:${line} - glossary term "${termId}" not found in glossary-terms.toml`
          );
        }
      }

      // LINK-2: Check linkImage paths exist
      if (tags.linkImage) {
        const imagePath = join(PROJECT_ROOT, 'experiences', implName, tags.linkImage);
        if (!existsSync(imagePath)) {
          errors.push(
            `LINK-2: ${relativePath}:${line} - image file not found: ${tags.linkImage}`
          );
        }
      }

      // LINK-3: Check card layout without image
      if (tags.linkLayout === 'card' && !tags.linkImage) {
        warnings.push(
          `LINK-3: ${relativePath}:${line} - card layout without linkImage`
        );
      }

      // LINK-4: Check inline layout without image
      if (tags.linkLayout === 'inline' && !tags.linkImage) {
        warnings.push(
          `LINK-4: ${relativePath}:${line} - inline layout without linkImage`
        );
      }
    }
  }

  if (ARGS.verbose) {
    console.log(`  Found ${previewCount} link preview(s)`);
  }

  return { errors, warnings };
}

/**
 * Main entry point
 */
function main() {
  if (ARGS.help) {
    showHelp();
  }

  console.log('Linting link preview tags...\n');

  const implRoot = join(PROJECT_ROOT, 'experiences');

  if (!existsSync(implRoot)) {
    console.log('No experiences directory found.');
    process.exit(0);
  }

  const impls = readdirSync(implRoot, { withFileTypes: true })
    .filter(d => d.isDirectory());

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const impl of impls) {
    if (ARGS.verbose) {
      console.log(`\n${impl.name}:`);
    }

    const { errors, warnings } = lintImplementation(impl.name);

    for (const err of errors) {
      console.log(`ERROR: ${err}`);
    }
    for (const warn of warnings) {
      console.log(`WARNING: ${warn}`);
    }

    totalErrors += errors.length;
    totalWarnings += warnings.length;
  }

  // Summary
  console.log('');
  if (totalErrors > 0) {
    console.log(`Found ${totalErrors} error(s), ${totalWarnings} warning(s).`);
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log(`No errors. ${totalWarnings} warning(s).`);
    process.exit(0);
  } else {
    console.log('All link preview tags valid.');
    process.exit(0);
  }
}

main();
