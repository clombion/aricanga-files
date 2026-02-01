#!/usr/bin/env node

/**
 * lint-i18n-parity.js - Validate i18n key parity across locale TOML files
 *
 * Checks that all locale TOML files have consistent structure:
 * - All locales have the same keys (no missing translations)
 * - Interpolation variables match across locales
 * - No locale has extra keys the base doesn't have
 * - No empty translations
 *
 * Usage:
 *   node utils/linting/ink/lint-i18n-parity.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show detailed key comparisons
 *
 * Exit codes:
 *   0 - All locales have parity
 *   1 - Parity violations found
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getPaths, getProjectRoot } from '../../../../utils/lib/locale-config.js';

const PROJECT_ROOT = getProjectRoot();
const BASE_LOCALE = 'en';

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
lint-i18n-parity.js - Validate i18n key parity across locale TOML files

USAGE
  node utils/linting/ink/lint-i18n-parity.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show detailed key comparisons

CHECKS
  • All locales have the same keys as base locale
  • Interpolation variables ({name}) match across locales
  • No empty translations
  • No extra keys in non-base locales

WHY THIS MATTERS
  Consistent i18n keys ensure translations work correctly and
  don't cause runtime errors or missing content.

EXIT CODES
  0  All locales have parity
  1  Parity violations found

EXAMPLES
  node utils/linting/ink/lint-i18n-parity.js         # Quick lint
  node utils/linting/ink/lint-i18n-parity.js -v      # Verbose output
`);
  process.exit(0);
}

/**
 * Simple TOML parser for locale files
 */
function parseTOML(content) {
  const result = {};
  let currentSection = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].split('.');
      continue;
    }

    const kvMatch = trimmed.match(/^(\w+)\s*=\s*["'](.*)["']$/);
    if (kvMatch && currentSection.length > 0) {
      const [, key, value] = kvMatch;
      const fullPath = [...currentSection, key];
      let current = result;
      for (let i = 0; i < fullPath.length - 1; i++) {
        if (!current[fullPath[i]]) current[fullPath[i]] = {};
        current = current[fullPath[i]];
      }
      current[fullPath[fullPath.length - 1]] = value;
    }
  }
  return result;
}

/**
 * Get all leaf keys from a nested object
 */
function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

/**
 * Extract interpolation variables from a string
 */
function extractVariables(str) {
  const matches = str.match(/\{(\w+)\}/g) || [];
  return matches.map((m) => m.slice(1, -1)).sort();
}

/**
 * Get value at a dot-separated path
 */
function getValueAtPath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Lint a single implementation's locale files
 */
function lintImplementation(implName) {
  const errors = [];
  const paths = getPaths(implName);
  const localesDir = paths.localesDir;

  if (!existsSync(localesDir)) {
    return errors; // No locales directory, skip
  }

  // Find all locale files
  const localeFiles = readdirSync(localesDir)
    .filter((f) => f.endsWith('.toml') && !f.includes('.rules.'))
    .map((f) => f.replace('.toml', ''));

  if (localeFiles.length === 0) {
    return errors; // No locale files, skip
  }

  if (ARGS.verbose) {
    console.log(`\n${implName}: locales = [${localeFiles.join(', ')}]`);
  }

  // Parse all locales
  const locales = new Map();
  for (const locale of localeFiles) {
    const content = readFileSync(join(localesDir, `${locale}.toml`), 'utf-8');
    locales.set(locale, parseTOML(content));
  }

  // Get base locale keys
  const baseData = locales.get(BASE_LOCALE);
  if (!baseData) {
    errors.push(`${implName}: Base locale ${BASE_LOCALE} not found`);
    return errors;
  }
  const baseKeys = getAllKeys(baseData);

  if (ARGS.verbose) {
    console.log(`  Base locale (${BASE_LOCALE}): ${baseKeys.length} keys`);
  }

  // Check key parity
  for (const [locale, data] of locales.entries()) {
    if (locale === BASE_LOCALE) continue;

    const localeKeys = getAllKeys(data);
    const missingKeys = baseKeys.filter((k) => !localeKeys.includes(k));
    const extraKeys = localeKeys.filter((k) => !baseKeys.includes(k));

    if (ARGS.verbose) {
      console.log(`  Locale ${locale}: ${localeKeys.length} keys`);
    }

    if (missingKeys.length > 0) {
      errors.push(`${implName}/${locale}: missing keys: ${missingKeys.join(', ')}`);
    }
    if (extraKeys.length > 0) {
      errors.push(`${implName}/${locale}: extra keys: ${extraKeys.join(', ')}`);
    }
  }

  // Check interpolation variables and empty translations
  for (const [locale, data] of locales.entries()) {
    const keys = getAllKeys(data);

    for (const key of keys) {
      const value = getValueAtPath(data, key);
      if (value === '') {
        errors.push(`${implName}/${locale}: empty translation at ${key}`);
      }

      // Check variable matching (only for non-base locales)
      if (locale !== BASE_LOCALE) {
        const baseValue = getValueAtPath(baseData, key);
        if (baseValue && value) {
          const baseVars = extractVariables(baseValue);
          const localeVars = extractVariables(value);
          if (baseVars.join(',') !== localeVars.join(',')) {
            errors.push(
              `${implName}/${locale}.${key}: variables mismatch - base has {${baseVars.join(', ')}}, locale has {${localeVars.join(', ')}}`
            );
          }
        }
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

  console.log('Linting i18n key parity...\n');

  const implRoot = join(PROJECT_ROOT, 'experiences');

  if (!existsSync(implRoot)) {
    console.log('No implementations directory found.');
    process.exit(0);
  }

  const impls = readdirSync(implRoot, { withFileTypes: true })
    .filter(d => d.isDirectory());

  let totalErrors = 0;

  for (const impl of impls) {
    const errors = lintImplementation(impl.name);

    if (errors.length > 0) {
      for (const err of errors) {
        console.log(`ERROR: ${err}`);
      }
      totalErrors += errors.length;
    } else if (ARGS.verbose) {
      console.log(`✓ ${impl.name}: all locale keys match`);
    }
  }

  // Summary
  console.log('');
  if (totalErrors > 0) {
    console.log(`Found ${totalErrors} i18n parity error(s).`);
    process.exit(1);
  } else {
    console.log(`All i18n keys have parity (${impls.length} implementation(s) checked).`);
    process.exit(0);
  }
}

main();
