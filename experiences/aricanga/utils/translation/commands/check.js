/**
 * check.js - Detailed locale completeness check
 *
 * Reports missing translations, empty strings, and ink file issues.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import TOML from '@iarna/toml';
import { getLocalePath, getProjectRoot, requireImpl } from '../../../../../utils/lib/locale-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = getProjectRoot();

/**
 * Show help for check command
 */
function showHelp() {
  console.log(`
check - Detailed locale completeness check

USAGE
  node experiences/aricanga/utils/translation/cli.js check <locale>

OPTIONS
  -h, --help              Show this help

CHECKS
  - Missing config keys (present in source but not target)
  - Empty translations (key exists but value is empty)
  - Ink file compilation errors
  - Wrong locale includes (.en.ink in fr folder)

EXIT CODES
  0 - Locale is complete
  1 - Issues found

EXAMPLES
  # Check French locale
  node experiences/aricanga/utils/translation/cli.js check fr

  # Check all non-source locales
  for locale in fr es de; do
    node experiences/aricanga/utils/translation/cli.js check $locale
  done
`);
}

/**
 * Get all string keys from TOML config
 */
function getTomlKeys(filePath) {
  if (!existsSync(filePath)) return new Map();

  const content = readFileSync(filePath, 'utf-8');
  const config = TOML.parse(content);
  const keys = new Map();

  function extractKeys(obj, path = []) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = [...path, key];
      if (typeof value === 'string') {
        keys.set(currentPath.join('.'), value);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        extractKeys(value, currentPath);
      }
    }
  }

  extractKeys(config);
  return keys;
}

/**
 * Check ink files for issues
 */
function checkInkFiles(locale, sourceLocale) {
  const issues = [];
  const impl = requireImpl();
  const inkDir = join(PROJECT_ROOT, `experiences/${impl}/ink/${locale}`);

  if (!existsSync(inkDir)) {
    issues.push({
      type: 'missing_directory',
      message: `Ink directory not found: experiences/${impl}/ink/${locale}`,
    });
    return issues;
  }

  const files = readdirSync(inkDir, { recursive: true });

  for (const file of files) {
    if (!file.endsWith('.ink')) continue;
    const filePath = join(inkDir, file);
    const content = readFileSync(filePath, 'utf-8');

    // Check for wrong locale includes
    const wrongIncludes = content.match(
      new RegExp(`INCLUDE.*\\.${sourceLocale}\\.ink`, 'g'),
    );
    if (wrongIncludes) {
      for (const include of wrongIncludes) {
        issues.push({
          type: 'wrong_locale_include',
          file: file,
          message: `References source locale: ${include}`,
        });
      }
    }
  }

  // Try to compile ink files
  const mainInk = join(inkDir, `main.${locale}.ink`);
  if (existsSync(mainInk)) {
    try {
      execSync(`inklecate -o /dev/null "${mainInk}" 2>&1`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error) {
      issues.push({
        type: 'compilation_error',
        file: `main.${locale}.ink`,
        message: 'Ink compilation failed',
        details: error.stdout || error.message,
      });
    }
  }

  return issues;
}

/**
 * Run check command
 */
export async function run(flags, positional) {
  if (flags.help || flags.h) {
    showHelp();
    return;
  }

  const locale = positional[0];
  const sourceLocale = 'en';

  if (!locale) {
    console.error('Error: Locale is required');
    console.error('Usage: node experiences/aricanga/utils/translation/cli.js check <locale>');
    process.exit(1);
  }

  if (locale === sourceLocale) {
    console.error(`Error: Cannot check source locale "${sourceLocale}"`);
    process.exit(1);
  }

  console.log(`Checking locale: ${locale}`);
  console.log('');

  let totalIssues = 0;

  // Check config keys
  const sourceConfigPath = getLocalePath(sourceLocale);
  const targetConfigPath = getLocalePath(locale);

  const sourceKeys = getTomlKeys(sourceConfigPath);
  const targetKeys = getTomlKeys(targetConfigPath);

  // Find missing keys
  const missingKeys = [];
  for (const [key] of sourceKeys) {
    if (!targetKeys.has(key)) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    console.log(`MISSING CONFIG KEYS (${missingKeys.length}):`);
    for (const key of missingKeys.slice(0, 10)) {
      console.log(`  ${key}`);
    }
    if (missingKeys.length > 10) {
      console.log(`  ... and ${missingKeys.length - 10} more`);
    }
    console.log('');
    totalIssues += missingKeys.length;
  }

  // Find empty translations
  const emptyKeys = [];
  for (const [key, value] of targetKeys) {
    if (sourceKeys.has(key) && sourceKeys.get(key).trim() && !value.trim()) {
      emptyKeys.push(key);
    }
  }

  if (emptyKeys.length > 0) {
    console.log(`EMPTY TRANSLATIONS (${emptyKeys.length}):`);
    for (const key of emptyKeys.slice(0, 10)) {
      console.log(`  ${key}`);
    }
    if (emptyKeys.length > 10) {
      console.log(`  ... and ${emptyKeys.length - 10} more`);
    }
    console.log('');
    totalIssues += emptyKeys.length;
  }

  // Check ink files
  const inkIssues = checkInkFiles(locale, sourceLocale);

  if (inkIssues.length > 0) {
    console.log(`INK FILE ISSUES (${inkIssues.length}):`);
    for (const issue of inkIssues) {
      if (issue.file) {
        console.log(`  ✗ ${issue.file}: ${issue.message}`);
      } else {
        console.log(`  ✗ ${issue.message}`);
      }
      if (issue.details) {
        console.log(`    ${issue.details.split('\n')[0]}`);
      }
    }
    console.log('');
    totalIssues += inkIssues.length;
  }

  // Summary
  console.log(`Summary: ${totalIssues} issues found`);

  if (totalIssues > 0) {
    process.exit(1);
  } else {
    console.log('✓ Locale check passed');
  }
}
