#!/usr/bin/env node

/**
 * lint-toml.js - Validate TOML configuration files
 *
 * Checks:
 * - TOML syntax validity (parse errors)
 * - Trailing whitespace (warning)
 * - Tab characters (warning, prefer spaces)
 * - Required sections exist in locale files (with --schema)
 * - Required fields exist per section (with --schema)
 *
 * Uses @iarna/toml parser (already a project dependency).
 *
 * Usage:
 *   node utils/linting/ink/lint-toml.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show skipped files and warnings
 *   --schema       Enable schema validation (required sections/fields)
 *
 * Examples:
 *   node utils/linting/ink/lint-toml.js              # Quick syntax lint
 *   node utils/linting/ink/lint-toml.js --verbose    # Show warnings too
 *   node utils/linting/ink/lint-toml.js --schema     # Include schema checks
 *
 * Exit codes:
 *   0 - All files valid
 *   1 - Parse errors found
 */

import TOML from '@iarna/toml';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');

// Dynamically discover all implementation data directories
function getLintPaths() {
  const paths = [];
  const implRoot = join(PROJECT_ROOT, 'implementations');
  if (!existsSync(implRoot)) return paths;

  const impls = readdirSync(implRoot, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const impl of impls) {
    const dataDir = join('implementations', impl.name, 'data');
    const configPath = join(dataDir, 'base-config.toml');
    const localesPath = join(dataDir, 'locales');

    if (existsSync(join(PROJECT_ROOT, configPath))) {
      paths.push(configPath);
    }
    if (existsSync(join(PROJECT_ROOT, localesPath))) {
      paths.push(localesPath);
    }
  }

  return paths;
}

// Files/directories to lint (all implementations)
const LINT_PATHS = getLintPaths();

// Parse CLI arguments
const ARGS = {
  help: process.argv.includes('--help') || process.argv.includes('-h'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  schema: process.argv.includes('--schema'),
};

// Required sections for locale TOML files
const REQUIRED_SECTIONS = [
  'ui.hub', 'ui.drawer', 'ui.tiles', 'ui.settings', 'ui.status',
  'ui.dates', 'ui.messages', 'ui.a11y',
  'chat_types.normal', 'chat_types.disappearing', 'chat_types.channel',
];

// Required fields per section
const REQUIRED_FIELDS = {
  'chat_types.normal': ['system_message'],
  'chat_types.disappearing': ['system_message'],
  'chat_types.channel': ['system_message', 'input_placeholder'],
};

/**
 * Print help message and exit
 */
function showHelp() {
  console.log(`
lint-toml.js - Validate TOML configuration files

USAGE
  node utils/linting/ink/lint-toml.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show skipped files and detailed warnings
  --schema       Enable schema validation (required sections/fields)

CHECKS
  • TOML syntax validity (parse errors)
  • Trailing whitespace (warning, --verbose to see)
  • Tab characters (warning, --verbose to see)
  • Required sections in locale files (--schema)
  • Required fields per section (--schema)

FILES CHECKED
  ${LINT_PATHS.join('\n  ')}

EXIT CODES
  0  All files valid
  1  Parse errors found

EXAMPLES
  node utils/linting/ink/lint-toml.js              # Quick lint
  node utils/linting/ink/lint-toml.js -v           # Verbose with warnings
  node utils/linting/ink/lint-toml.js --schema     # Include schema checks
`);
  process.exit(0);
}

/**
 * Find all .toml files in a path (file or directory)
 */
function findTomlFiles(path) {
  const fullPath = join(PROJECT_ROOT, path);
  const files = [];

  try {
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(fullPath)) {
        if (entry.endsWith('.toml')) {
          files.push(join(fullPath, entry));
        }
      }
    } else if (path.endsWith('.toml')) {
      files.push(fullPath);
    }
  } catch (e) {
    if (ARGS.verbose) {
      console.log(`  [skip] ${path} - ${e.message}`);
    }
  }

  return files;
}

/**
 * Get all keys from a nested object with dot-separated paths
 */
function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
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
  return current;
}

/**
 * Validate schema for locale files
 */
function validateSchema(data, fileName) {
  const schemaErrors = [];

  // Only validate locale files (not base-config.toml or .rules.toml)
  if (fileName.includes('base-config') || fileName.includes('.rules.')) {
    return schemaErrors;
  }

  const keys = getAllKeys(data);

  // Check required sections
  for (const section of REQUIRED_SECTIONS) {
    if (!keys.some((k) => k.startsWith(section + '.'))) {
      schemaErrors.push(`Missing required section [${section}]`);
    }
  }

  // Check required fields
  for (const [section, fields] of Object.entries(REQUIRED_FIELDS)) {
    for (const field of fields) {
      const key = `${section}.${field}`;
      const value = getValueAtPath(data, key);
      if (value === undefined || value === null) {
        schemaErrors.push(`Missing required field: ${key}`);
      }
    }
  }

  return schemaErrors;
}

/**
 * Lint a single TOML file
 * @returns {{ file: string, errors: Array, warnings: Array }}
 */
function lintFile(filePath) {
  const relativePath = relative(PROJECT_ROOT, filePath);
  const errors = [];
  const warnings = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Check for style issues
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (line !== line.trimEnd()) {
        warnings.push({ line: lineNum, message: 'Trailing whitespace' });
      }

      if (line.includes('\t')) {
        warnings.push({
          line: lineNum,
          message: 'Tab character (prefer spaces)',
        });
      }
    }

    // Parse to check syntax
    const data = TOML.parse(content);

    // Schema validation if enabled
    if (ARGS.schema) {
      const schemaErrors = validateSchema(data, relativePath);
      for (const err of schemaErrors) {
        errors.push({ line: 1, message: `Schema: ${err}` });
      }
    }
  } catch (e) {
    // Parse error
    const match = e.message.match(/at row (\d+), col (\d+)/);
    if (match) {
      errors.push({
        line: parseInt(match[1]),
        col: parseInt(match[2]),
        message: e.message,
      });
    } else {
      errors.push({ line: 1, message: e.message });
    }
  }

  return { file: relativePath, errors, warnings };
}

/**
 * Main entry point
 */
function main() {
  if (ARGS.help) {
    showHelp();
  }

  console.log('Linting TOML files...');
  if (ARGS.verbose) {
    console.log(`  Paths: ${LINT_PATHS.join(', ')}\n`);
  } else {
    console.log('');
  }

  // Collect all files
  const allFiles = [];
  for (const path of LINT_PATHS) {
    allFiles.push(...findTomlFiles(path));
  }

  if (allFiles.length === 0) {
    console.log('No TOML files found.');
    process.exit(0);
  }

  let hasErrors = false;
  let totalWarnings = 0;

  for (const file of allFiles) {
    const result = lintFile(file);
    const { errors, warnings } = result;

    if (errors.length > 0) {
      hasErrors = true;
      console.log(`✗ ${result.file}`);
      for (const err of errors) {
        const loc = err.col ? `${err.line}:${err.col}` : err.line;
        console.log(`  ${loc}: error: ${err.message}`);
      }
    } else {
      console.log(`✓ ${result.file}`);
    }

    // Show warnings in verbose mode
    if (ARGS.verbose && warnings.length > 0) {
      for (const warn of warnings) {
        console.log(`  ${warn.line}: warning: ${warn.message}`);
      }
    }

    totalWarnings += warnings.length;
  }

  // Summary
  console.log(`\nChecked ${allFiles.length} file(s).`);
  if (totalWarnings > 0) {
    if (ARGS.verbose) {
      console.log(`${totalWarnings} warning(s) shown above.`);
    } else {
      console.log(`${totalWarnings} warning(s) hidden (use --verbose to see).`);
    }
  }

  process.exit(hasErrors ? 1 : 0);
}

main();
