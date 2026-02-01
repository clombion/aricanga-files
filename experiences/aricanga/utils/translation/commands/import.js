/**
 * import.js - Apply translations from file
 *
 * Imports translated strings from JSON, prompt response, or XLIFF files
 * back into TOML config and ink files.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import TOML from '@iarna/toml';
import {
  applyInkPatches,
  cleanupBackup,
  createBackup,
  restoreBackup,
  validateInkFile,
} from '../../../../../utils/lib/ink-writer.js';
import { getLocalePaths, getLocalePath, getProjectRoot } from '../../../../../utils/lib/locale-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = getProjectRoot();

/**
 * Show help for import command
 */
function showHelp() {
  console.log(`
import - Apply translations to locale files

USAGE
  node experiences/aricanga/utils/translation/cli.js import <file> [options]

OPTIONS
  -l, --locale <code>     Target locale (required)
  -f, --format <type>     Input format: prompt|json|xliff (auto-detected)
      --dry-run           Preview changes without writing
      --strict            Fail if any IDs don't match source
      --force             Override source text mismatch warnings
      --skip-validation   Skip placeholder and compilation validation
      --no-backup         Don't create .bak files (not recommended)
  -h, --help              Show this help

WHAT IT DOES
  1. Reads translation file (JSON, XLIFF, or prompt format)
  2. For config strings: Updates {locale}.toml
  3. For ink strings: Patches ink/{locale}/chats/*.ink files
  4. Validates placeholders preserved
  5. Creates .bak backups before modifying files

INPUT FORMATS
  prompt    JSON extracted from LLM response (markdown code block)
  json      Structured JSON from API
  xliff     XLIFF 2.0 from Crowdin

EXAMPLES
  # Preview what would change
  node experiences/aricanga/utils/translation/cli.js import translations.json -l fr --dry-run

  # Apply translations
  node experiences/aricanga/utils/translation/cli.js import translations.json -l fr

  # Force through mismatched source text
  node experiences/aricanga/utils/translation/cli.js import translations.json -l fr --force

ERROR HANDLING
  - Missing target files: Run 'mise run tl:init <locale>' first
  - Line mismatch: Source changed since extraction, re-extract
  - Placeholder errors: Translation must preserve {variables}
`);
}

/**
 * Detect file format from content or extension
 */
function detectFormat(filePath, content) {
  if (filePath.endsWith('.xliff') || filePath.endsWith('.xlf')) {
    return 'xliff';
  }
  if (filePath.endsWith('.json')) {
    return 'json';
  }
  // Try to detect from content
  if (content.trim().startsWith('<?xml') || content.includes('<xliff')) {
    return 'xliff';
  }
  if (content.trim().startsWith('{')) {
    return 'json';
  }
  // Default to prompt (extract JSON from markdown)
  return 'prompt';
}

/**
 * Parse prompt format (extract JSON from markdown code block)
 * @param {string} content - Markdown content with JSON code block
 * @returns {Array} Parsed translation items
 * @throws {Error} If no JSON code block found
 */
export function parsePrompt(content) {
  // Look for JSON code block
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    throw new Error('No JSON code block found in prompt response');
  }

  const json = JSON.parse(jsonMatch[1]);
  return json.items || json.strings || [];
}

/**
 * Parse JSON format
 * @param {string} content - JSON string
 * @returns {Array} Parsed translation items (from items or strings key)
 */
export function parseJson(content) {
  const json = JSON.parse(content);
  return json.items || json.strings || [];
}

/**
 * Parse XLIFF format
 * @param {string} content - XLIFF XML string
 * @returns {Array} Parsed translation items with id, source, translation
 */
export function parseXliff(content) {
  const items = [];

  // Simple regex-based XLIFF parser
  const unitRegex =
    /<unit id="([^"]+)"[\s\S]*?<source>([\s\S]*?)<\/source>[\s\S]*?<target>([\s\S]*?)<\/target>/g;
  let match;

  while ((match = unitRegex.exec(content)) !== null) {
    items.push({
      id: unescapeXml(match[1]),
      source: unescapeXml(match[2]),
      translation: unescapeXml(match[3]),
    });
  }

  return items;
}

/**
 * Unescape XML entities
 */
function unescapeXml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Apply config translations to TOML file
 * @param {Array} items - Translation items
 * @param {string} locale - Target locale
 * @param {Object} options - { dryRun, noBackup }
 * @returns {{ applied: number, errors: string[], warnings: string[], changes: Array }}
 */
function applyConfigTranslations(items, locale, options = {}) {
  const { dryRun = false, noBackup = false } = options;
  const configPath = getLocalePath(locale);
  const result = { applied: 0, errors: [], warnings: [], changes: [] };

  if (!existsSync(configPath)) {
    result.errors.push(
      `Config file not found: ${configPath}\nRun 'mise run tl:init ${locale}' to create locale files first.`,
    );
    return result;
  }

  const content = readFileSync(configPath, 'utf-8');
  const config = TOML.parse(content);

  for (const item of items) {
    if (!item.id.startsWith('config.')) continue;
    if (!item.translation) continue;

    const path = item.id.replace('config.', '').split('.');
    let obj = config;

    // Navigate to parent
    for (let i = 0; i < path.length - 1; i++) {
      if (!obj[path[i]]) {
        obj[path[i]] = {};
      }
      obj = obj[path[i]];
    }

    const key = path[path.length - 1];
    const oldValue = obj[key];
    obj[key] = item.translation;
    result.applied++;

    result.changes.push({
      id: item.id,
      old: oldValue,
      new: item.translation,
    });
  }

  if (dryRun) {
    console.log(`\nConfig changes (${locale}.toml):`);
    for (const change of result.changes) {
      console.log(`  ${change.id}:`);
      console.log(`    - "${change.old}"`);
      console.log(`    + "${change.new}"`);
    }
  } else if (result.applied > 0) {
    // Create backup
    if (!noBackup) {
      try {
        createBackup(configPath);
      } catch (err) {
        result.errors.push(
          `Cannot create backup for ${configPath}: ${err.message}`,
        );
        return result;
      }
    }

    // Write file
    try {
      writeFileSync(configPath, TOML.stringify(config));
      console.log(`Updated ${result.applied} strings in ${locale}.toml`);
    } catch (err) {
      if (!noBackup) restoreBackup(configPath);
      result.errors.push(`Cannot write ${configPath}: ${err.message}`);
      return result;
    }

    // Clean up backup
    if (!noBackup) cleanupBackup(configPath);
  }

  return result;
}

/**
 * Apply ink translations to locale ink files
 * @param {Array} items - Translation items
 * @param {string} locale - Target locale
 * @param {Object} options - { dryRun, force, skipValidation, noBackup }
 * @returns {{ applied: number, skipped: number, errors: string[], warnings: string[] }}
 */
function applyInkTranslations(items, locale, options = {}) {
  const { dryRun = false } = options;
  const result = { applied: 0, skipped: 0, errors: [], warnings: [] };

  // Filter to ink items (not config)
  const inkItems = items.filter(
    (i) => !i.id.startsWith('config.') && i.translation,
  );

  if (inkItems.length === 0) {
    return result;
  }

  // Get locale paths
  const localePaths = getLocalePaths(locale);

  // Group items by source file
  const byFile = new Map();
  for (const item of inkItems) {
    if (!item.file) {
      result.warnings.push(`${item.id}: Missing file reference, skipping`);
      result.skipped++;
      continue;
    }

    const sourceFile = item.file;
    if (!byFile.has(sourceFile)) {
      byFile.set(sourceFile, []);
    }
    byFile.get(sourceFile).push(item);
  }

  // Process each file
  for (const [sourceFile, fileItems] of byFile) {
    // Map source file to target: activist.en.ink -> activist.fr.ink
    const targetFile = sourceFile.replace(/\.en\.ink$/, `.${locale}.ink`);

    // Handle files in chats/ subfolder vs root
    let targetPath;
    if (sourceFile.includes('/')) {
      // Already has path
      targetPath = join(localePaths.inkBaseDir, targetFile);
    } else {
      // Assume it's in chats/
      targetPath = join(localePaths.inkBaseDir, 'chats', targetFile);
    }

    // Build patches from items
    const patches = fileItems
      .filter((item) => item.line)
      .map((item) => ({
        lineNum: item.line,
        translation: item.translation,
        unit: {
          id: item.id,
          source: item.source,
          type: item.type || 'dialogue',
          placeholders: item.placeholders,
          highlights: item.highlights,
        },
      }));

    if (patches.length === 0) {
      result.warnings.push(`${sourceFile}: No valid line references, skipping`);
      result.skipped += fileItems.length;
      continue;
    }

    // Apply patches
    const patchResult = applyInkPatches(targetPath, patches, options);

    // Aggregate results
    result.applied += patchResult.applied;
    result.skipped += patchResult.skipped;
    result.errors.push(...patchResult.errors);
    result.warnings.push(...patchResult.warnings);

    // Validate ink file compiles (unless dry-run or skip-validation)
    if (!dryRun && !options.skipValidation && patchResult.applied > 0) {
      const validation = validateInkFile(targetPath);
      if (!validation.valid) {
        result.warnings.push(
          `${targetFile}: Ink compilation warning after import:\n  ${validation.error}`,
        );
      }
    }

    // Show diff in dry-run mode
    if (dryRun && patchResult.diff.length > 0) {
      console.log(`\nInk changes (${targetFile}):`);
      for (const change of patchResult.diff) {
        console.log(`  Line ${change.lineNum} (${change.id}):`);
        console.log(`    - "${truncate(change.original, 60)}"`);
        console.log(`    + "${truncate(change.patched, 60)}"`);
      }
    }
  }

  if (!dryRun && result.applied > 0) {
    console.log(`Updated ${result.applied} strings in ink files`);
  }

  return result;
}

/**
 * Truncate string for display
 */
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 3)}...`;
}

/**
 * Update translation state
 */
function updateState(items, locale) {
  const stateDir = join(__dirname, '../.state');
  const statePath = join(stateDir, `${locale}.json`);

  let state = { locale, strings: {} };
  if (existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, 'utf-8'));
  }

  for (const item of items) {
    if (!item.translation) continue;

    if (state.strings[item.id]) {
      state.strings[item.id].status = 'translated';
      state.strings[item.id].translation = item.translation;
    }
  }

  state.lastImport = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Run import command
 */
export async function run(flags, positional) {
  if (flags.help || flags.h) {
    showHelp();
    return;
  }

  const filePath = positional[0];
  const locale = flags.locale || flags.l;
  const format = flags.format || flags.f;
  const dryRun = flags['dry-run'] || false;
  const strict = flags.strict || false;
  const force = flags.force || false;
  const skipValidation = flags['skip-validation'] || false;
  const noBackup = flags['no-backup'] || false;

  // Build options object
  const options = { dryRun, force, skipValidation, noBackup };

  // Validate inputs
  if (!filePath) {
    console.error('Error: Input file is required');
    console.error(
      'Usage: node experiences/aricanga/utils/translation/cli.js import <file> -l <locale>',
    );
    process.exit(1);
  }

  if (!locale) {
    console.error('Error: Target locale is required (-l or --locale)');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`Error: Translation file not found: ${filePath}`);
    process.exit(1);
  }

  // Read and parse file
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`Error: Cannot read ${filePath}: ${err.message}`);
    process.exit(1);
  }

  const detectedFormat = format || detectFormat(filePath, content);

  console.log(`Importing from ${filePath} (format: ${detectedFormat})`);
  console.log(`Target locale: ${locale}`);
  if (dryRun) console.log('DRY RUN - no files will be modified');

  let items;
  try {
    switch (detectedFormat) {
      case 'prompt':
        items = parsePrompt(content);
        break;
      case 'json':
        items = parseJson(content);
        break;
      case 'xliff':
        items = parseXliff(content);
        break;
      default:
        throw new Error(`Unknown format: ${detectedFormat}`);
    }
  } catch (error) {
    const lineMatch = error.message.match(/position (\d+)/);
    if (lineMatch) {
      console.error(
        `Error: Invalid JSON in ${filePath} near position ${lineMatch[1]}: ${error.message}`,
      );
    } else {
      console.error(`Error parsing file: ${error.message}`);
    }
    process.exit(1);
  }

  console.log(`Found ${items.length} translation items`);

  // Filter to items with translations
  const translated = items.filter((i) => i.translation);
  console.log(`${translated.length} items have translations`);

  if (translated.length === 0) {
    console.log('No translations to import.');
    return;
  }

  // Apply translations
  const configResult = applyConfigTranslations(translated, locale, options);
  const inkResult = applyInkTranslations(translated, locale, options);

  // Collect all errors and warnings
  const allErrors = [...configResult.errors, ...inkResult.errors];
  const allWarnings = [...configResult.warnings, ...inkResult.warnings];

  // Show warnings
  if (allWarnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of allWarnings) {
      console.log(`  ${warning}`);
    }
  }

  // Show errors
  if (allErrors.length > 0) {
    console.log('\nErrors:');
    for (const error of allErrors) {
      console.log(`  ${error}`);
    }
  }

  // Update state (unless dry run or errors in strict mode)
  if (!dryRun && !(strict && allErrors.length > 0)) {
    updateState(translated, locale);
  }

  // Summary
  console.log('\nSummary:');
  console.log(`  Config strings: ${configResult.applied} applied`);
  console.log(
    `  Ink strings: ${inkResult.applied} applied, ${inkResult.skipped} skipped`,
  );

  // Exit with error if strict mode and there were errors/warnings
  if (strict && (allErrors.length > 0 || allWarnings.length > 0)) {
    console.error('\nStrict mode: failing due to errors/warnings');
    process.exit(1);
  }

  // Exit with error if there were critical errors
  if (allErrors.length > 0) {
    process.exit(1);
  }
}
