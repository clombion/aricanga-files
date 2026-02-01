#!/usr/bin/env node

/**
 * lint-glossary-parity.js - Validate glossary term parity across config and locales
 *
 * Checks that glossary-terms.toml and locale files are in sync:
 * - All term IDs in glossary-terms.toml have entries in each locale
 * - Each locale entry has both 'term' and 'definition' keys
 * - No orphan glossary.terms entries that don't exist in base config
 *
 * Usage:
 *   node utils/ink/lint-glossary-parity.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show detailed term comparisons
 *
 * Exit codes:
 *   0 - All glossary terms have parity
 *   1 - Parity violations found
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
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
lint-glossary-parity.js - Validate glossary term parity across config and locales

USAGE
  node utils/ink/lint-glossary-parity.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show detailed term comparisons

CHECKS
  • All term IDs in glossary-terms.toml have [glossary.terms.{id}] in each locale
  • Each locale entry has both 'term' and 'definition' keys
  • No orphan glossary.terms entries without matching base config ID

WHY THIS MATTERS
  Ensures glossary terms display correctly in all languages. Missing
  translations cause the raw ID to show as fallback.

EXIT CODES
  0  All glossary terms have parity
  1  Parity violations found

EXAMPLES
  node utils/ink/lint-glossary-parity.js         # Quick lint
  node utils/ink/lint-glossary-parity.js -v      # Verbose output
`);
  process.exit(0);
}

/**
 * Parse glossary-terms.toml to extract term IDs
 * @param {string} content - TOML file content
 * @returns {string[]} Array of term IDs
 */
function parseGlossaryTerms(content) {
  const ids = [];
  let currentId = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed === '[[terms]]') {
      if (currentId) ids.push(currentId);
      currentId = null;
      continue;
    }

    const idMatch = trimmed.match(/^id\s*=\s*"([^"]+)"/);
    if (idMatch) {
      currentId = idMatch[1];
    }
  }

  // Don't forget last term
  if (currentId) ids.push(currentId);

  return ids.sort();
}

/**
 * Parse locale TOML to extract glossary.terms entries
 * @param {string} content - TOML file content
 * @returns {Map<string, {term?: string, definition?: string}>} Map of term ID to fields
 */
function parseLocaleGlossaryTerms(content) {
  const terms = new Map();
  let currentTermId = null;
  let currentFields = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Match [glossary.terms.{id}]
    const sectionMatch = trimmed.match(/^\[glossary\.terms\.([^\]]+)\]$/);
    if (sectionMatch) {
      // Save previous term
      if (currentTermId) {
        terms.set(currentTermId, currentFields);
      }
      currentTermId = sectionMatch[1];
      currentFields = {};
      continue;
    }

    // Match key = "value" within glossary.terms section
    if (currentTermId) {
      const kvMatch = trimmed.match(/^(term|definition)\s*=\s*"(.*)"/);
      if (kvMatch) {
        currentFields[kvMatch[1]] = kvMatch[2];
      }
    }

    // Reset if we hit a different section
    if (trimmed.startsWith('[') && !trimmed.startsWith('[glossary.terms.')) {
      if (currentTermId) {
        terms.set(currentTermId, currentFields);
      }
      currentTermId = null;
      currentFields = {};
    }
  }

  // Don't forget last term
  if (currentTermId) {
    terms.set(currentTermId, currentFields);
  }

  return terms;
}

/**
 * Lint a single implementation's glossary parity
 * @param {string} implName - Implementation name
 * @returns {string[]} Array of error messages
 */
function lintImplementation(implName) {
  const errors = [];
  const paths = getPaths(implName);

  const glossaryPath = join(paths.dataDir, 'glossary-terms.toml');
  const localesDir = paths.localesDir;

  // Check if glossary-terms.toml exists
  if (!existsSync(glossaryPath)) {
    if (ARGS.verbose) {
      console.log(`  ${implName}: No glossary-terms.toml found, skipping`);
    }
    return errors;
  }

  // Parse base glossary terms
  const glossaryContent = readFileSync(glossaryPath, 'utf-8');
  const baseTermIds = parseGlossaryTerms(glossaryContent);

  if (ARGS.verbose) {
    console.log(`\n${implName}: ${baseTermIds.length} terms in glossary-terms.toml`);
    console.log(`  Term IDs: ${baseTermIds.join(', ')}`);
  }

  if (baseTermIds.length === 0) {
    return errors; // No terms defined, nothing to check
  }

  // Find all locale files
  if (!existsSync(localesDir)) {
    errors.push(`${implName}: locales directory not found`);
    return errors;
  }

  const localeFiles = readdirSync(localesDir)
    .filter((f) => f.endsWith('.toml') && !f.includes('.rules.'))
    .map((f) => f.replace('.toml', ''));

  if (ARGS.verbose) {
    console.log(`  Locales: ${localeFiles.join(', ')}`);
  }

  // Check each locale
  for (const locale of localeFiles) {
    const localePath = join(localesDir, `${locale}.toml`);
    const localeContent = readFileSync(localePath, 'utf-8');
    const localeTerms = parseLocaleGlossaryTerms(localeContent);

    if (ARGS.verbose) {
      console.log(`  ${locale}.toml: ${localeTerms.size} glossary.terms entries`);
    }

    // Check all base terms exist in locale
    for (const termId of baseTermIds) {
      if (!localeTerms.has(termId)) {
        errors.push(
          `${implName}/${locale}: missing [glossary.terms.${termId}] section`,
        );
        continue;
      }

      const fields = localeTerms.get(termId);

      // Check required fields
      if (!fields.term) {
        errors.push(
          `${implName}/${locale}: [glossary.terms.${termId}] missing 'term' field`,
        );
      }
      if (!fields.definition) {
        errors.push(
          `${implName}/${locale}: [glossary.terms.${termId}] missing 'definition' field`,
        );
      }
    }

    // Check for orphan terms in locale (not in base config)
    for (const localeTermId of localeTerms.keys()) {
      if (!baseTermIds.includes(localeTermId)) {
        errors.push(
          `${implName}/${locale}: orphan [glossary.terms.${localeTermId}] not in glossary-terms.toml`,
        );
      }
    }
  }

  return errors;
}

/**
 * Main entry point
 */
function main() {
  if (ARGS.help) {
    showHelp();
  }

  console.log('Linting glossary term parity...\n');

  const implRoot = join(PROJECT_ROOT, 'experiences');

  if (!existsSync(implRoot)) {
    console.log('No experiences directory found.');
    process.exit(0);
  }

  const impls = readdirSync(implRoot, { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  );

  let totalErrors = 0;
  let implsWithGlossary = 0;

  for (const impl of impls) {
    const errors = lintImplementation(impl.name);

    if (errors.length > 0) {
      for (const err of errors) {
        console.log(`ERROR: ${err}`);
      }
      totalErrors += errors.length;
      implsWithGlossary++;
    } else {
      // Check if this impl has a glossary
      const paths = getPaths(impl.name);
      if (existsSync(join(paths.dataDir, 'glossary-terms.toml'))) {
        implsWithGlossary++;
        if (ARGS.verbose) {
          console.log(`✓ ${impl.name}: all glossary terms have parity`);
        }
      }
    }
  }

  // Summary
  console.log('');
  if (totalErrors > 0) {
    console.log(`Found ${totalErrors} glossary parity error(s).`);
    process.exit(1);
  } else if (implsWithGlossary > 0) {
    console.log(
      `All glossary terms have parity (${implsWithGlossary} implementation(s) checked).`,
    );
    process.exit(0);
  } else {
    console.log('No implementations with glossary-terms.toml found.');
    process.exit(0);
  }
}

main();
