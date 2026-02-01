/**
 * init.js - Initialize new locale
 *
 * Creates the necessary files and directories for a new locale:
 * - TOML config file (copied from source)
 * - Ink directory with copied files
 * - Updates base-config.toml to add the new locale
 */

import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import TOML from '@iarna/toml';
import { requireImpl, getProjectRoot } from '../../../../../utils/lib/locale-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = getProjectRoot();

/**
 * Common locale names for auto-detection
 */
const LOCALE_NAMES = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  'pt-BR': 'Português (Brasil)',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  'zh-TW': '繁體中文',
  ar: 'العربية',
  ru: 'Русский',
  nl: 'Nederlands',
  pl: 'Polski',
  sv: 'Svenska',
  da: 'Dansk',
  fi: 'Suomi',
  no: 'Norsk',
  tr: 'Türkçe',
  el: 'Ελληνικά',
  he: 'עברית',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  hi: 'हिन्दी',
  uk: 'Українська',
  cs: 'Čeština',
  ro: 'Română',
  hu: 'Magyar',
};

/**
 * Show help for init command
 */
function showHelp() {
  console.log(`
init - Initialize new locale

USAGE
  node experiences/aricanga/utils/translation/cli.js init <locale>

OPTIONS
  -s, --source <code>     Source locale to copy from (default: en)
  -n, --name <name>       Display name for the locale (auto-detected if common)
      --dry-run           Preview changes without writing
  -h, --help              Show this help

CREATES
  - experiences/<impl>/data/locales/<locale>.toml (copied from source)
  - experiences/<impl>/ink/<locale>/ directory with ink files (renamed)
  - Updates base-config.toml to add the locale

EXAMPLES
  # Initialize Spanish locale
  node experiences/aricanga/utils/translation/cli.js init es

  # Initialize from French as source
  node experiences/aricanga/utils/translation/cli.js init de --source fr

  # Initialize with custom locale name
  node experiences/aricanga/utils/translation/cli.js init ca --name "Català"

  # Preview what would be created
  node experiences/aricanga/utils/translation/cli.js init es --dry-run
`);
}

/**
 * Transform TOML header to reflect target locale
 */
function updateTomlHeader(content, sourceLocale, localeName) {
  // Get source locale name for the header pattern
  const sourceLocaleName = LOCALE_NAMES[sourceLocale] || 'English';

  return content.replace(
    new RegExp(`# Capital Chronicle - ${sourceLocaleName} Locale`, 'g'),
    `# Capital Chronicle - ${localeName} Locale`,
  );
}

/**
 * Rename locale references in ink file content
 */
function renameLocaleInInk(content, sourceLocale, targetLocale) {
  // Replace .{source}.ink with .{target}.ink in INCLUDE statements
  return content.replace(
    new RegExp(`\\.${sourceLocale}\\.ink`, 'g'),
    `.${targetLocale}.ink`,
  );
}

/**
 * Run init command
 */
export async function run(flags, positional) {
  if (flags.help || flags.h) {
    showHelp();
    return;
  }

  const targetLocale = positional[0];
  const sourceLocale = flags.source || flags.s || 'en';
  const dryRun = flags['dry-run'] || false;

  if (!targetLocale) {
    console.error('Error: Locale code is required');
    console.error('Usage: node experiences/aricanga/utils/translation/cli.js init <locale>');
    process.exit(1);
  }

  // Validate locale code (simple BCP 47 check)
  if (!targetLocale.match(/^[a-z]{2}(-[A-Z]{2})?$/)) {
    console.error(
      `Error: Invalid locale code "${targetLocale}". Use format like "es" or "pt-BR".`,
    );
    process.exit(1);
  }

  // Get or detect locale name
  const localeName = flags.name || flags.n || LOCALE_NAMES[targetLocale];
  if (!localeName) {
    console.error(
      `Error: Unknown locale "${targetLocale}". Please provide a display name with --name.`,
    );
    console.error(
      'Example: node experiences/aricanga/utils/translation/cli.js init ca --name "Català"',
    );
    process.exit(1);
  }

  console.log(`Initializing locale: ${targetLocale} (${localeName})`);
  console.log(`Source locale: ${sourceLocale}`);
  if (dryRun) console.log('DRY RUN - no files will be created');
  console.log('');

  // Get implementation from IMPL env var
  const impl = requireImpl();

  // Check source locale exists
  const sourceConfigPath = join(
    PROJECT_ROOT,
    `experiences/${impl}/data/locales/${sourceLocale}.toml`,
  );
  const sourceInkDir = join(PROJECT_ROOT, `experiences/${impl}/ink/${sourceLocale}`);

  if (!existsSync(sourceConfigPath)) {
    console.error(`Error: Source config not found: ${sourceConfigPath}`);
    process.exit(1);
  }

  if (!existsSync(sourceInkDir)) {
    console.error(`Error: Source ink directory not found: ${sourceInkDir}`);
    process.exit(1);
  }

  // Check target doesn't already exist
  const targetConfigPath = join(
    PROJECT_ROOT,
    `experiences/${impl}/data/locales/${targetLocale}.toml`,
  );
  const targetInkDir = join(PROJECT_ROOT, `experiences/${impl}/ink/${targetLocale}`);

  if (existsSync(targetConfigPath)) {
    console.error(`Error: Target config already exists: ${targetConfigPath}`);
    process.exit(1);
  }

  if (existsSync(targetInkDir)) {
    console.error(
      `Error: Target ink directory already exists: ${targetInkDir}`,
    );
    process.exit(1);
  }

  // 1. Copy TOML config with header transformation
  console.log(`Creating ${targetLocale}.toml...`);
  if (!dryRun) {
    let configContent = readFileSync(sourceConfigPath, 'utf-8');
    configContent = updateTomlHeader(configContent, sourceLocale, localeName);
    writeFileSync(targetConfigPath, configContent);
  }
  console.log(`  Created: experiences/${impl}/data/locales/${targetLocale}.toml`);

  // 2. Copy ink directory
  console.log(`Creating ink/${targetLocale}/...`);
  if (!dryRun) {
    // Copy entire directory structure
    cpSync(sourceInkDir, targetInkDir, { recursive: true });

    // Rename files from source locale to target locale
    const { readdirSync, renameSync } = await import('node:fs');
    const renameFiles = (dir) => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const oldPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          renameFiles(oldPath);
        } else if (entry.name.includes(`.${sourceLocale}.`)) {
          const newName = entry.name.replace(
            `.${sourceLocale}.`,
            `.${targetLocale}.`,
          );
          const newPath = join(dir, newName);
          renameSync(oldPath, newPath);

          // Update file content
          let content = readFileSync(newPath, 'utf-8');
          content = renameLocaleInInk(content, sourceLocale, targetLocale);
          writeFileSync(newPath, content);
        }
      }
    };
    renameFiles(targetInkDir);
  }
  console.log(`  Created: experiences/${impl}/ink/${targetLocale}/`);

  // 3. Update base-config.toml
  console.log('Updating base-config.toml...');
  const baseConfigPath = join(PROJECT_ROOT, `experiences/${impl}/data/base-config.toml`);
  const baseConfig = TOML.parse(readFileSync(baseConfigPath, 'utf-8'));

  if (!baseConfig.i18n) {
    baseConfig.i18n = {};
  }
  if (!baseConfig.i18n.available_locales) {
    baseConfig.i18n.available_locales = [sourceLocale];
  }
  if (!baseConfig.i18n.locale_names) {
    baseConfig.i18n.locale_names = {};
  }

  let configChanged = false;

  if (!baseConfig.i18n.available_locales.includes(targetLocale)) {
    baseConfig.i18n.available_locales.push(targetLocale);
    configChanged = true;
    console.log(`  Added "${targetLocale}" to available_locales`);
  } else {
    console.log(`  "${targetLocale}" already in available_locales`);
  }

  if (!baseConfig.i18n.locale_names[targetLocale]) {
    baseConfig.i18n.locale_names[targetLocale] = localeName;
    configChanged = true;
    console.log(`  Added "${targetLocale}" = "${localeName}" to locale_names`);
  } else {
    console.log(`  "${targetLocale}" already in locale_names`);
  }

  if (configChanged && !dryRun) {
    writeFileSync(baseConfigPath, TOML.stringify(baseConfig));
  }

  console.log('');
  console.log(`Locale "${targetLocale}" initialized successfully!`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Extract strings: mise run tl -l ${targetLocale}`);
  console.log('  2. Translate the extracted strings');
  console.log(
    `  3. Import translations: mise run tl:import -l ${targetLocale} <file>`,
  );
  console.log(`  4. Build: mise run build`);
}
