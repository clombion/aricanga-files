#!/usr/bin/env node

/**
 * lint-locale-parity.js - Validate ink file parity across locales
 *
 * Checks that ink file structure and naming is consistent across locales:
 * - All ink files in locale folders follow {name}.{locale}.ink pattern
 * - variables.ink exists at ink root (shared across locales)
 * - All locales have matching files (pat.en.ink ↔ pat.fr.ink)
 *
 * Usage:
 *   node utils/linting/ink/lint-locale-parity.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show detailed file lists
 *
 * Exit codes:
 *   0 - All locales have parity
 *   1 - Parity violations found
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');
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
lint-locale-parity.js - Validate ink file parity across locales

USAGE
  node utils/linting/ink/lint-locale-parity.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show detailed file lists

CHECKS
  • Ink files follow {name}.{locale}.ink naming convention
  • All locales have ink folder entries in config
  • All locale folders exist
  • variables.ink exists at ink root (shared)
  • All locales have matching files

WHY THIS MATTERS
  Consistent file structure ensures the translation workflow works
  correctly and all locales have the same narrative content.

EXIT CODES
  0  All locales have parity
  1  Parity violations found

EXAMPLES
  node utils/linting/ink/lint-locale-parity.js         # Quick lint
  node utils/linting/ink/lint-locale-parity.js -v      # Verbose output
`);
  process.exit(0);
}

/**
 * Parse i18n section from base-config.toml
 */
function parseI18nConfig(configPath) {
  const content = readFileSync(configPath, 'utf-8');

  // Extract available_locales
  const localesMatch = content.match(/available_locales\s*=\s*\[([^\]]+)\]/);
  const available_locales = localesMatch
    ? localesMatch[1]
        .split(',')
        .map((s) => s.trim().replace(/["']/g, ''))
        .filter(Boolean)
    : [];

  // Extract ink_folders
  const ink_folders = {};
  const folderRegex = /^\s*(\w+)\s*=\s*"([^"]+)"/gm;
  const inkFoldersSection = content.match(/\[i18n\.ink_folders\]([\s\S]*?)(?=\n\[|$)/);

  if (inkFoldersSection) {
    let match;
    while ((match = folderRegex.exec(inkFoldersSection[1])) !== null) {
      ink_folders[match[1]] = match[2];
    }
  }

  return { available_locales, ink_folders };
}

/**
 * Get all .ink files in a directory recursively
 */
function getInkFiles(dir, basePath = '') {
  const files = [];

  if (!existsSync(dir)) {
    return files;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...getInkFiles(join(dir, entry.name), relativePath));
    } else if (entry.name.endsWith('.ink')) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

/**
 * Strip locale suffix from filename
 */
function stripLocaleSuffix(filename, locale) {
  return filename.replace(new RegExp(`\\.${locale}\\.ink$`), '');
}

/**
 * Lint a single implementation
 */
function lintImplementation(implName, implRoot) {
  const errors = [];
  const configPath = join(implRoot, 'data/base-config.toml');
  const inkRoot = join(implRoot, 'ink');

  if (!existsSync(configPath)) {
    errors.push(`Config not found: ${configPath}`);
    return errors;
  }

  const config = parseI18nConfig(configPath);

  if (ARGS.verbose) {
    console.log(`\n${implName}: locales = [${config.available_locales.join(', ')}]`);
  }

  // Check all declared locales have ink folder entries
  for (const locale of config.available_locales) {
    if (!config.ink_folders[locale]) {
      errors.push(`${implName}: Locale "${locale}" declared but missing from [i18n.ink_folders]`);
    }
  }

  // Check all ink folder paths exist
  for (const [locale, folder] of Object.entries(config.ink_folders)) {
    if (!existsSync(folder)) {
      errors.push(`${implName}: Ink folder for locale "${locale}" does not exist: ${folder}`);
    }
  }

  // Check variables.ink exists at ink root
  const variablesPath = join(inkRoot, 'variables.ink');
  if (!existsSync(variablesPath)) {
    errors.push(`${implName}: variables.ink not found at ink root (${inkRoot})`);
  }

  // Check variables.ink does NOT exist in locale folders
  for (const [locale, folder] of Object.entries(config.ink_folders)) {
    const localeVariablesPath = join(folder, 'chats/variables.ink');
    const localeVariablesPath2 = join(folder, `chats/variables.${locale}.ink`);

    if (existsSync(localeVariablesPath)) {
      errors.push(`${implName}: variables.ink should not exist in locale folder (${localeVariablesPath})`);
    }
    if (existsSync(localeVariablesPath2)) {
      errors.push(`${implName}: variables.${locale}.ink should not exist - variables.ink is shared at root`);
    }
  }

  // Check naming convention
  for (const [locale, folder] of Object.entries(config.ink_folders)) {
    if (!existsSync(folder)) continue;
    const files = getInkFiles(folder);

    for (const file of files) {
      const expectedPattern = new RegExp(`\\.${locale}\\.ink$`);
      if (!expectedPattern.test(file)) {
        errors.push(`${implName}/${locale}: file "${file}" does not follow naming convention (expected *.${locale}.ink)`);
      }
    }
  }

  // Check locale parity
  const baseFolder = config.ink_folders[BASE_LOCALE];
  if (baseFolder && existsSync(baseFolder)) {
    const baseFiles = getInkFiles(baseFolder);
    const baseNames = baseFiles.map((f) => stripLocaleSuffix(f, BASE_LOCALE)).sort();

    if (ARGS.verbose) {
      console.log(`  Base locale (${BASE_LOCALE}): ${baseFiles.length} files`);
    }

    for (const [locale, folder] of Object.entries(config.ink_folders)) {
      if (locale === BASE_LOCALE) continue;
      if (!existsSync(folder)) continue;

      const localeFiles = getInkFiles(folder);
      const localeNames = localeFiles.map((f) => stripLocaleSuffix(f, locale)).sort();

      if (ARGS.verbose) {
        console.log(`  Locale ${locale}: ${localeFiles.length} files`);
      }

      // Check for missing files
      for (const baseName of baseNames) {
        if (!localeNames.includes(baseName)) {
          errors.push(`${implName}/${locale}: missing file for "${baseName}" (expected ${baseName}.${locale}.ink)`);
        }
      }

      // Check for extra files
      for (const localeName of localeNames) {
        if (!baseNames.includes(localeName)) {
          errors.push(`${implName}/${locale}: extra file "${localeName}.${locale}.ink" not in base locale`);
        }
      }
    }

    // Check base locale has required files
    if (!baseFiles.some(f => f === `main.${BASE_LOCALE}.ink`)) {
      errors.push(`${implName}: base locale missing main.${BASE_LOCALE}.ink`);
    }

    const chatFiles = baseFiles.filter((f) => f.startsWith('chats/'));
    if (chatFiles.length === 0) {
      errors.push(`${implName}: base locale has no chat files in chats/`);
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

  console.log('Linting ink locale parity...\n');

  const implRoot = join(PROJECT_ROOT, 'implementations');

  if (!existsSync(implRoot)) {
    console.log('No implementations directory found.');
    process.exit(0);
  }

  const impls = readdirSync(implRoot, { withFileTypes: true })
    .filter(d => d.isDirectory());

  let totalErrors = 0;

  for (const impl of impls) {
    const implPath = join(implRoot, impl.name);
    const errors = lintImplementation(impl.name, implPath);

    if (errors.length > 0) {
      for (const err of errors) {
        console.log(`ERROR: ${err}`);
      }
      totalErrors += errors.length;
    } else if (ARGS.verbose) {
      console.log(`✓ ${impl.name}: all locales have parity`);
    }
  }

  // Summary
  console.log('');
  if (totalErrors > 0) {
    console.log(`Found ${totalErrors} locale parity error(s).`);
    process.exit(1);
  } else {
    console.log(`All locale files have parity (${impls.length} implementation(s) checked).`);
    process.exit(0);
  }
}

main();
