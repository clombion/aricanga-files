/**
 * extract.js - Generate translation payload
 *
 * Extracts translatable strings from ink files and TOML config,
 * outputs in various formats for LLM, API, or Crowdin.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import TOML from '@iarna/toml';
import { hashString, parseLocaleInkFiles } from '../../../../../utils/lib/ink-parser.js';
import { getLocalePaths, getLocalePath, getProjectRoot, requireImpl } from '../../../../../utils/lib/locale-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = getProjectRoot();

/**
 * Load UI constraints from base-config.toml
 */
function loadConstraints() {
  const impl = requireImpl();
  const baseConfigPath = join(PROJECT_ROOT, 'experiences', impl, 'data/base-config.toml');
  if (!existsSync(baseConfigPath)) {
    return {};
  }
  const content = readFileSync(baseConfigPath, 'utf-8');
  const config = TOML.parse(content);
  return config.ui?.constraints || {};
}

/**
 * Mapping from config paths to constraint UI elements
 * Format: { pattern: 'constraintSection.constraintKey' }
 */
const CONSTRAINT_MAP = {
  // Hub strings
  'config.characters.*.display_name': 'hub.character_name',
  // Chat strings
  'config.chat_types.*.system_message': 'chat.system_message',
  // Settings strings
  'config.ui.settings.*': 'settings.option_label',
  // Notifications
  'config.ui.notifications.*': 'notifications.body',
};

/**
 * Get constraint for a config path
 */
function getConstraint(configId, constraints) {
  // Try exact patterns first
  for (const [pattern, constraintPath] of Object.entries(CONSTRAINT_MAP)) {
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]+') + '$',
    );
    if (regex.test(configId)) {
      const [section, key] = constraintPath.split('.');
      const maxLength = constraints[section]?.[key];
      if (maxLength) {
        return { maxLength, uiElement: constraintPath };
      }
    }
  }
  return null;
}

/**
 * Show help for extract command
 */
function showHelp() {
  console.log(`
extract - Generate translation payload

USAGE
  node experiences/aricanga/utils/translation/cli.js extract [options]

OPTIONS
  -l, --locale <code>     Target locale (required)
  -s, --source <code>     Source locale (default: en)
  -f, --format <type>     Output format: prompt|json|xliff (default: prompt)
      --scope <type>      What to extract: all|config|ink (default: all)
      --incremental       Only new/changed strings
  -o, --out <path>        Output file (default: stdout)
  -h, --help              Show this help

OUTPUT FORMATS
  prompt    Human-readable for LLM/manual translation
  json      Structured JSON for API integration
  xliff     XLIFF 2.0 for Crowdin (experimental)

EXAMPLES
  # Extract for ChatGPT (copy-paste the output)
  node experiences/aricanga/utils/translation/cli.js extract -l fr -f prompt

  # Extract as JSON for API
  node experiences/aricanga/utils/translation/cli.js extract -l fr -f json -o fr.json

  # Only extract config strings
  node experiences/aricanga/utils/translation/cli.js extract -l fr --scope config

  # Only new/changed strings
  node experiences/aricanga/utils/translation/cli.js extract -l fr --incremental
`);
}

/**
 * Extract strings from TOML config files
 */
function extractConfigStrings(sourceLocale, constraints = {}) {
  const units = [];
  const localePath = getLocalePath(sourceLocale);

  if (!existsSync(localePath)) {
    console.error(`Source locale file not found: ${localePath}`);
    return units;
  }

  const content = readFileSync(localePath, 'utf-8');
  const config = TOML.parse(content);

  // Recursively extract strings from nested TOML structure
  function extractFromObject(obj, path = []) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = [...path, key];
      if (typeof value === 'string') {
        const id = `config.${currentPath.join('.')}`;
        const unit = {
          id,
          type: 'config',
          source: value,
          file: `${sourceLocale}.toml`,
          locale: sourceLocale,
          context: `TOML path: ${currentPath.join('.')}`,
        };

        // Add constraint if available
        const constraint = getConstraint(id, constraints);
        if (constraint) {
          unit.constraints = constraint;
        }

        units.push(unit);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        extractFromObject(value, currentPath);
      }
    }
  }

  extractFromObject(config);
  return units;
}

/**
 * Load translation state for incremental extraction
 */
function loadState(locale) {
  const stateDir = join(__dirname, '../.state');
  const statePath = join(stateDir, `${locale}.json`);

  if (!existsSync(statePath)) {
    return { locale, strings: {} };
  }

  return JSON.parse(readFileSync(statePath, 'utf-8'));
}

/**
 * Save translation state
 */
function saveState(locale, units) {
  const stateDir = join(__dirname, '../.state');
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  const state = {
    locale,
    lastExtract: new Date().toISOString(),
    strings: {},
  };

  for (const unit of units) {
    state.strings[unit.id] = {
      sourceHash: hashString(unit.source),
      source: unit.source,
      status: 'new',
    };
  }

  const statePath = join(stateDir, `${locale}.json`);
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Filter units for incremental extraction
 * Excludes strings already marked as 'translated' with unchanged source hash
 * @param {Array} units - Translation units to filter
 * @param {Object} state - State object with strings map
 * @returns {Array} Filtered units needing translation
 */
export function filterIncremental(units, state) {
  return units.filter((unit) => {
    const existing = state.strings[unit.id];
    if (!existing) return true; // New string

    const currentHash = hashString(unit.source);
    if (currentHash !== existing.sourceHash) {
      return true; // Source changed
    }

    return existing.status !== 'translated'; // Not yet translated
  });
}

/**
 * Format output as prompt (for LLM)
 */
function formatPrompt(units, sourceLocale, targetLocale) {
  const lines = [];

  lines.push(
    `# Translation: ${sourceLocale.toUpperCase()} -> ${targetLocale.toUpperCase()}`,
  );
  lines.push(`# Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push(`# Strings: ${units.length}`);
  lines.push('');
  lines.push('## Instructions');
  lines.push('');
  lines.push('1. Preserve {variables} exactly as written');
  lines.push('2. Preserve ((text::source)) markers exactly');
  lines.push('3. Translate the text naturally for the target language');
  lines.push('4. Return ONLY the JSON block below with translations filled in');
  lines.push('');

  // Group by file for context
  const byFile = {};
  for (const unit of units) {
    const file = unit.file || 'other';
    if (!byFile[file]) byFile[file] = [];
    byFile[file].push(unit);
  }

  lines.push('## Content');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "items": [');

  const items = units.map((unit, i) => {
    const item = {
      id: unit.id,
      source: unit.source,
      translation: '',
    };
    if (unit.context) item.context = unit.context;
    if (unit.placeholders && Object.keys(unit.placeholders).length > 0) {
      item.placeholders = Object.keys(unit.placeholders);
    }
    if (unit.highlights && unit.highlights.length > 0) {
      item.highlights = unit.highlights.map((h) => h.full);
    }
    return `    ${JSON.stringify(item)}${i < units.length - 1 ? ',' : ''}`;
  });

  lines.push(...items);
  lines.push('  ]');
  lines.push('}');
  lines.push('```');

  return lines.join('\n');
}

/**
 * Format output as JSON (for API)
 */
function formatJson(units, sourceLocale, targetLocale) {
  return JSON.stringify(
    {
      metadata: {
        source: sourceLocale,
        target: targetLocale,
        generated: new Date().toISOString(),
        count: units.length,
      },
      strings: units.map((unit) => {
        const str = {
          id: unit.id,
          type: unit.type,
          source: unit.source,
          translation: '',
          context: unit.context,
          file: unit.file,
          line: unit.line,
          placeholders: unit.placeholders,
          highlights: unit.highlights,
        };
        // Only include constraints if present
        if (unit.constraints) {
          str.constraints = unit.constraints;
        }
        return str;
      }),
    },
    null,
    2,
  );
}

/**
 * Format output as XLIFF 2.0 (for Crowdin)
 */
function formatXliff(units, sourceLocale, targetLocale) {
  const lines = [];

  console.error(
    'WARNING: XLIFF/Crowdin integration is experimental and untested.',
  );
  console.error('Please report issues at the project repository.\n');

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0"',
  );
  lines.push(`       srcLang="${sourceLocale}" trgLang="${targetLocale}">`);

  // Group by file
  const byFile = {};
  for (const unit of units) {
    const file = unit.file || 'other';
    if (!byFile[file]) byFile[file] = [];
    byFile[file].push(unit);
  }

  for (const [file, fileUnits] of Object.entries(byFile)) {
    lines.push(`  <file id="${escapeXml(file)}">`);

    for (const unit of fileUnits) {
      lines.push(`    <unit id="${escapeXml(unit.id)}">`);
      if (unit.context) {
        lines.push('      <notes>');
        lines.push(
          `        <note category="context">${escapeXml(unit.context)}</note>`,
        );
        lines.push('      </notes>');
      }
      lines.push('      <segment>');
      lines.push(`        <source>${escapeXml(unit.source)}</source>`);
      lines.push('        <target></target>');
      lines.push('      </segment>');
      lines.push('    </unit>');
    }

    lines.push('  </file>');
  }

  lines.push('</xliff>');

  return lines.join('\n');
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Run extract command
 */
export async function run(flags, _positional) {
  // Show help if requested
  if (flags.help || flags.h) {
    showHelp();
    return;
  }

  // Parse options
  const targetLocale = flags.locale || flags.l;
  const sourceLocale = flags.source || flags.s || 'en';
  const format = flags.format || flags.f || 'prompt';
  const scope = flags.scope || 'all';
  const incremental = flags.incremental || false;
  const outputPath = flags.out || flags.o;

  // Validate required options
  if (!targetLocale) {
    console.error('Error: Target locale is required (-l or --locale)');
    console.error('Run with --help for usage.');
    process.exit(1);
  }

  // Validate format
  if (!['prompt', 'json', 'xliff'].includes(format)) {
    console.error(
      `Error: Unknown format "${format}". Use prompt, json, or xliff.`,
    );
    process.exit(1);
  }

  // Load constraints from base-config.toml
  const constraints = loadConstraints();

  // Collect units
  let units = [];

  // Extract from ink files
  if (scope === 'all' || scope === 'ink') {
    const localePaths = getLocalePaths(sourceLocale);
    // Use inkBaseDir for translation extraction (includes main.ink and chats/)
    const inkUnits = parseLocaleInkFiles(localePaths.inkBaseDir, sourceLocale);
    units.push(...inkUnits);
  }

  // Extract from config
  if (scope === 'all' || scope === 'config') {
    const configUnits = extractConfigStrings(sourceLocale, constraints);
    units.push(...configUnits);
  }

  // Filter for incremental
  if (incremental) {
    const state = loadState(targetLocale);
    units = filterIncremental(units, state);
    console.error(`Incremental: ${units.length} new/changed strings`);
  }

  if (units.length === 0) {
    console.error('No strings to extract.');
    return;
  }

  // Save state for future incremental extracts
  saveState(targetLocale, units);

  // Format output
  let output;
  switch (format) {
    case 'prompt':
      output = formatPrompt(units, sourceLocale, targetLocale);
      break;
    case 'json':
      output = formatJson(units, sourceLocale, targetLocale);
      break;
    case 'xliff':
      output = formatXliff(units, sourceLocale, targetLocale);
      break;
  }

  // Write output
  if (outputPath) {
    writeFileSync(outputPath, output);
    console.error(`Wrote ${units.length} strings to ${outputPath}`);
  } else {
    console.log(output);
  }
}
