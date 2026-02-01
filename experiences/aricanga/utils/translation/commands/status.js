/**
 * status.js - Show translation progress
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import TOML from '@iarna/toml';
import { getBaseConfigPath, getLocalePath, getProjectRoot, requireImpl } from '../../../../../utils/lib/locale-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = getProjectRoot();

/**
 * Show help for status command
 */
function showHelp() {
  console.log(`
status - Show translation progress

USAGE
  node experiences/aricanga/utils/translation/cli.js status [options]

OPTIONS
  -l, --locale <code>     Specific locale (default: all)
  -v, --verbose           Show per-file breakdown
      --check             CI mode: exit 1 if any locale incomplete
  -h, --help              Show this help

OUTPUT
  Shows translation coverage for each configured locale.

EXIT CODES (with --check)
  0 - All locales complete (100% coverage)
  1 - One or more locales incomplete

EXAMPLES
  # Show all locales
  node experiences/aricanga/utils/translation/cli.js status

  # Show specific locale
  node experiences/aricanga/utils/translation/cli.js status -l fr

  # Detailed breakdown
  node experiences/aricanga/utils/translation/cli.js status -v

  # CI check (fail if incomplete)
  node experiences/aricanga/utils/translation/cli.js status --check
`);
}

/**
 * Load available locales from config
 */
function getAvailableLocales() {
  const configPath = getBaseConfigPath();
  const config = TOML.parse(readFileSync(configPath, 'utf-8'));
  return config.i18n?.available_locales || ['en'];
}

/**
 * Count strings in a TOML file
 */
function countTomlStrings(filePath) {
  if (!existsSync(filePath)) return 0;

  const content = readFileSync(filePath, 'utf-8');
  const config = TOML.parse(content);

  let count = 0;
  function countStrings(obj) {
    for (const value of Object.values(obj)) {
      if (typeof value === 'string') {
        count++;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        countStrings(value);
      }
    }
  }
  countStrings(config);
  return count;
}

/**
 * Count translatable strings in ink files
 */
function countInkStrings(inkDir) {
  if (!existsSync(inkDir)) return 0;

  let count = 0;
  const files = readdirSync(inkDir, { recursive: true });

  for (const file of files) {
    if (!file.endsWith('.ink')) continue;
    const filePath = join(inkDir, file);
    const content = readFileSync(filePath, 'utf-8');

    // Simple heuristic: count non-empty lines that aren't control flow
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('//')) continue;
      if (trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('~')) continue;
      if (trimmed.startsWith('->')) continue;
      if (trimmed.startsWith('===')) continue;
      if (trimmed.match(/^=\s*\w+\s*$/)) continue;
      if (trimmed === '}') continue;
      if (trimmed.match(/^\{[^{}]+:\s*$/)) continue;

      // Choice text
      if (trimmed.match(/^[*+]\s*\[/)) {
        count++;
        continue;
      }

      // Regular dialogue
      if (!trimmed.startsWith('{') || trimmed.includes(':')) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Load state file for locale
 */
function loadState(locale) {
  const statePath = join(__dirname, '../.state', `${locale}.json`);
  if (!existsSync(statePath)) {
    return null;
  }
  return JSON.parse(readFileSync(statePath, 'utf-8'));
}

/**
 * Run status command
 */
export async function run(flags, _positional) {
  if (flags.help || flags.h) {
    showHelp();
    return;
  }

  const targetLocale = flags.locale || flags.l;
  const verbose = flags.verbose || flags.v;
  const checkMode = flags.check || false;

  const locales = getAvailableLocales();
  const sourceLocale = 'en';

  // Count source strings
  const impl = requireImpl();
  const sourceConfigPath = getLocalePath(sourceLocale);
  const sourceInkDir = join(PROJECT_ROOT, `experiences/${impl}/ink/${sourceLocale}`);
  const sourceConfigCount = countTomlStrings(sourceConfigPath);
  const sourceInkCount = countInkStrings(sourceInkDir);
  const totalSource = sourceConfigCount + sourceInkCount;

  // Track incomplete locales for --check mode
  const incompleteLocales = [];

  if (!checkMode) {
    console.log(`Source locale: ${sourceLocale}`);
    console.log(`  Config strings: ${sourceConfigCount}`);
    console.log(`  Ink strings: ~${sourceInkCount}`);
    console.log(`  Total: ~${totalSource}`);
    console.log('');

    // Table header
    console.log('Locale  Config   Ink      Total    Status');
    console.log('──────────────────────────────────────────────────');
  }

  for (const locale of locales) {
    if (targetLocale && locale !== targetLocale) continue;
    if (locale === sourceLocale) continue;

    const configPath = getLocalePath(locale);
    const inkDir = join(PROJECT_ROOT, `experiences/${impl}/ink/${locale}`);

    const configCount = countTomlStrings(configPath);
    const inkCount = countInkStrings(inkDir);
    const total = configCount + inkCount;
    const totalPct = totalSource ? Math.round((total / totalSource) * 100) : 0;

    let status = '';
    if (total === 0) {
      status = 'Not started';
    } else if (totalPct < 50) {
      status = 'In progress';
    } else if (totalPct < 100) {
      status = 'Partial';
    } else {
      status = 'Complete';
    }

    // Track incomplete for --check mode
    if (totalPct < 100) {
      const missing = totalSource - total;
      incompleteLocales.push({ locale, missing, totalPct });
    }

    if (checkMode) {
      // In check mode, only output incomplete locales
      if (totalPct < 100) {
        const missing = totalSource - total;
        console.log(
          `✗ ${locale}: ${missing} untranslated strings (${totalPct}%)`,
        );
      }
    } else {
      const configCol = `${configCount}/${sourceConfigCount}`.padEnd(8);
      const inkCol = `${inkCount}/${sourceInkCount}`.padEnd(8);
      const totalCol = `${totalPct}%`.padEnd(8);

      console.log(
        `${locale.padEnd(7)} ${configCol} ${inkCol} ${totalCol} ${status}`,
      );

      if (verbose) {
        const state = loadState(locale);
        if (state) {
          const stateStrings = Object.keys(state.strings || {}).length;
          const translated = Object.values(state.strings || {}).filter(
            (s) => s.status === 'translated',
          ).length;
          const fuzzy = Object.values(state.strings || {}).filter(
            (s) => s.status === 'fuzzy',
          ).length;
          console.log(
            `        State: ${translated} translated, ${fuzzy} fuzzy, ${stateStrings - translated - fuzzy} new`,
          );
          console.log(`        Last extract: ${state.lastExtract || 'never'}`);
        }
      }
    }
  }

  // In check mode, exit with appropriate code
  if (checkMode) {
    if (incompleteLocales.length === 0) {
      console.log('✓ All locales complete');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}
