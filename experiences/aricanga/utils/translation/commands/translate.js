/**
 * translate.js - LLM-powered translation command
 *
 * Translates extracted strings using AI providers.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import TOML from '@iarna/toml';

import { parseLocaleInkFiles } from '../../../../../utils/lib/ink-parser.js';
import { getLocalePaths, getLocalePath, getBaseConfigPath, getProjectRoot, requireImpl } from '../../../../../utils/lib/locale-config.js';
import {
  getAvailableProviders,
  getProviderEnvKey,
  isProviderConfigured,
  translate,
  validateTranslation,
} from '../llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = getProjectRoot();

/**
 * Load character voice descriptions from rules.toml
 * @param {string} locale - Locale code
 * @returns {Object} Character name -> voice description
 */
function loadCharacterVoices(locale) {
  // Rules file is alongside locale file: {locale}.rules.toml
  const rulesPath = getLocalePath(locale).replace('.toml', '.rules.toml');
  if (!existsSync(rulesPath)) return {};

  try {
    const content = readFileSync(rulesPath, 'utf-8');
    const rules = TOML.parse(content);
    return rules.style_guide?.characters || {};
  } catch {
    return {};
  }
}

/**
 * Load translation glossary for consistent terminology
 * @returns {Array} Glossary terms with actions and translations
 */
function loadGlossary() {
  const impl = requireImpl();
  const glossaryPath = join(PROJECT_ROOT, 'implementations', impl, 'data/glossary.toml');
  if (!existsSync(glossaryPath)) return [];

  try {
    const content = readFileSync(glossaryPath, 'utf-8');
    const parsed = TOML.parse(content);
    return parsed.terms || [];
  } catch {
    return [];
  }
}

/**
 * Show help for translate command
 */
function showHelp() {
  const providers = getAvailableProviders().join(', ');
  console.log(`
translate - Translate strings using LLM

USAGE
  node experiences/aricanga/utils/translation/cli.js translate [options]

OPTIONS
  -l, --locale <code>     Target locale (required)
  -p, --provider <name>   LLM provider: ${providers} (default: anthropic)
  -m, --model <name>      Model override (uses provider default if not set)
      --scope <type>      What to translate: all|config|ink (default: all)
      --batch <n>         Items per API call (default: 20)
      --dry-run           Show what would be sent without calling API
  -o, --out <path>        Output file (default: stdout)
  -h, --help              Show this help

ENVIRONMENT
  ANTHROPIC_API_KEY            Required for anthropic provider
  GOOGLE_GENERATIVE_AI_API_KEY Required for google provider (free tier available)
  OPENAI_API_KEY               Required for openai provider

EXAMPLES
  # Translate to French using Claude
  export ANTHROPIC_API_KEY=sk-ant-...
  node experiences/aricanga/utils/translation/cli.js translate -l fr -p anthropic

  # Preview what would be sent
  node experiences/aricanga/utils/translation/cli.js translate -l fr --dry-run

  # Use Gemini (free tier)
  export GOOGLE_GENERATIVE_AI_API_KEY=...
  node experiences/aricanga/utils/translation/cli.js translate -l fr -p google

  # Use GPT-4o
  export OPENAI_API_KEY=sk-...
  node experiences/aricanga/utils/translation/cli.js translate -l fr -p openai

  # Use fake provider for testing (no API key needed)
  node experiences/aricanga/utils/translation/cli.js translate -l fr -p fake

  # Output to file
  node experiences/aricanga/utils/translation/cli.js translate -l fr -o fr-translations.json
`);
}

/**
 * Extract strings from TOML config
 */
function extractConfigStrings(sourceLocale) {
  const units = [];
  const localePath = getLocalePath(sourceLocale);

  if (!existsSync(localePath)) return units;

  let config;
  try {
    const content = readFileSync(localePath, 'utf-8');
    config = TOML.parse(content);
  } catch (err) {
    console.error(`Warning: Failed to parse ${localePath}: ${err.message}`);
    return units;
  }

  function extractFromObject(obj, path = []) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = [...path, key];
      if (typeof value === 'string') {
        const id = `config.${currentPath.join('.')}`;
        units.push({
          id,
          type: 'config',
          source: value,
          context: `TOML path: ${currentPath.join('.')}`,
        });
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        extractFromObject(value, currentPath);
      }
    }
  }

  extractFromObject(config);
  return units;
}

/**
 * Load constraints from base-config.toml
 */
function loadConstraints() {
  const configPath = getBaseConfigPath();
  if (!existsSync(configPath)) return {};

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = TOML.parse(content);
    return config.ui?.constraints || {};
  } catch (err) {
    console.error(`Warning: Failed to parse base-config.toml: ${err.message}`);
    return {};
  }
}

/**
 * Get locale display name
 */
function getLocaleName(locale) {
  const configPath = getBaseConfigPath();
  if (!existsSync(configPath)) return locale.toUpperCase();

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = TOML.parse(content);
    return config.i18n?.locale_names?.[locale] || locale.toUpperCase();
  } catch {
    return locale.toUpperCase();
  }
}

/**
 * Chunk array into batches (simple chunking)
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Create conversation-aware batches that keep related dialogue together
 * Groups by knot (conversation thread) and maintains line order
 * @param {Array} units - Translation units
 * @param {number} batchSize - Max items per batch
 * @returns {Array<Array>} Batches
 */
function createConversationBatches(units, batchSize) {
  // Group by knot (conversation thread)
  const byKnot = new Map();
  for (const unit of units) {
    // Extract knot from context string "knot: xxx" or id "knotname.stitch.line_N"
    const knotFromContext = unit.context?.match(/knot: (\w+)/)?.[1];
    const knotFromId = unit.id?.split('.')[0];
    const knot = knotFromContext || knotFromId || 'global';

    if (!byKnot.has(knot)) byKnot.set(knot, []);
    byKnot.get(knot).push(unit);
  }

  const batches = [];

  for (const [_knot, knotUnits] of byKnot) {
    // Sort by line number within knot to maintain conversation flow
    const sorted = knotUnits.sort((a, b) => (a.line || 0) - (b.line || 0));

    // Chunk while keeping conversation together
    for (let i = 0; i < sorted.length; i += batchSize) {
      batches.push(sorted.slice(i, i + batchSize));
    }
  }

  return batches;
}

/**
 * Run translate command
 */
export async function run(flags, _positional) {
  if (flags.help || flags.h) {
    showHelp();
    return;
  }

  const targetLocale = flags.locale || flags.l;
  const providerName = flags.provider || flags.p || 'anthropic';
  const modelOverride = flags.model || flags.m;
  const scope = flags.scope || 'all';
  const batchSize = Number.parseInt(flags.batch, 10) || 20;
  const dryRun = flags['dry-run'] || false;
  const outputPath = flags.out || flags.o;
  const sourceLocale = 'en';

  if (!targetLocale) {
    console.error('Error: Target locale is required (-l or --locale)');
    console.error('Run with --help for usage.');
    process.exit(1);
  }

  // Validate provider
  const availableProviders = getAvailableProviders();
  if (!availableProviders.includes(providerName)) {
    console.error(
      `Error: Unknown provider "${providerName}". Available: ${availableProviders.join(', ')}`,
    );
    process.exit(1);
  }

  // Check API key (unless dry-run)
  if (!dryRun && !isProviderConfigured(providerName)) {
    const envKey = getProviderEnvKey(providerName) || `${providerName.toUpperCase()}_API_KEY`;
    console.error(`Error: Missing ${envKey} environment variable`);
    console.error(`Set it with: export ${envKey}=your-api-key`);
    process.exit(1);
  }

  // Collect items to translate
  const items = [];
  const constraints = loadConstraints();

  if (scope === 'all' || scope === 'config') {
    const configItems = extractConfigStrings(sourceLocale, constraints);
    items.push(...configItems);
  }

  if (scope === 'all' || scope === 'ink') {
    const localePaths = getLocalePaths(sourceLocale);
    const inkItems = parseLocaleInkFiles(localePaths.inkBaseDir, sourceLocale);
    items.push(...inkItems);
  }

  if (items.length === 0) {
    console.error('No strings to translate.');
    return;
  }

  const targetName = getLocaleName(targetLocale);
  console.error(`Translating ${items.length} strings to ${targetName}...`);
  console.error(
    `Provider: ${providerName}${modelOverride ? ` (${modelOverride})` : ''}`,
  );
  console.error(`Batch size: ${batchSize}`);
  console.error('');

  if (dryRun) {
    console.error('DRY RUN - showing first batch that would be sent:');
    console.error('');

    const firstBatch = items.slice(0, Math.min(batchSize, 5));
    const output = {
      provider: providerName,
      model: modelOverride || 'default',
      targetLocale,
      batchCount: Math.ceil(items.length / batchSize),
      totalItems: items.length,
      sampleBatch: firstBatch.map((item) => ({
        id: item.id,
        source: item.source.slice(0, 100),
        context: item.context,
      })),
    };

    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Load context for this translation session
  const characterVoices = loadCharacterVoices('en'); // Source locale rules
  const glossary = loadGlossary();

  // Build batch context passed to LLM
  const batchContext = {
    targetLocale: { code: targetLocale, name: targetName },
    characters: characterVoices,
    glossary,
  };

  if (glossary.length > 0) {
    console.error(`Glossary loaded: ${glossary.length} terms`);
  }

  // Process in conversation-aware batches (keeps dialogue together)
  const batches = createConversationBatches(items, batchSize);
  const allTranslations = [];
  const validationWarnings = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.error(`Processing batch ${i + 1}/${batches.length}...`);

    // Enrich batch items with speaker voice descriptions
    const enrichedBatch = batch.map((item) => {
      if (item.speaker && characterVoices[item.speaker.toLowerCase()]) {
        return {
          ...item,
          speakerVoice: characterVoices[item.speaker.toLowerCase()],
        };
      }
      return item;
    });

    try {
      const translations = await translate(
        providerName,
        enrichedBatch,
        targetName,
        modelOverride,
        batchContext,
      );

      // Merge translations with original items and validate
      for (const translation of translations) {
        const original = batch.find((item) => item.id === translation.id);
        if (original) {
          // Validate translation preserves placeholders/markers
          const errors = validateTranslation(
            original.source,
            translation.translation,
          );
          if (errors.length > 0) {
            validationWarnings.push({
              id: translation.id,
              errors,
            });
          }

          allTranslations.push({
            id: translation.id,
            source: original.source,
            translation: translation.translation,
            type: original.type,
            context: original.context,
            warnings: errors.length > 0 ? errors : undefined,
          });
        }
      }
    } catch (error) {
      console.error(`Error in batch ${i + 1}: ${error.message}`);
      // Continue with other batches
    }
  }

  // Report validation warnings
  if (validationWarnings.length > 0) {
    console.error('');
    console.error(`⚠️  Validation warnings: ${validationWarnings.length} items`);
    for (const warning of validationWarnings.slice(0, 5)) {
      console.error(`  - ${warning.id}:`);
      for (const err of warning.errors) {
        console.error(`      ${err.message}`);
      }
    }
    if (validationWarnings.length > 5) {
      console.error(`  ... and ${validationWarnings.length - 5} more`);
    }
  }

  // Format output
  const output = JSON.stringify(
    {
      metadata: {
        source: sourceLocale,
        target: targetLocale,
        provider: providerName,
        model: modelOverride || 'default',
        generated: new Date().toISOString(),
        count: allTranslations.length,
        warnings: validationWarnings.length || undefined,
      },
      strings: allTranslations,
    },
    null,
    2,
  );

  if (outputPath) {
    writeFileSync(outputPath, output);
    console.error(
      `Wrote ${allTranslations.length} translations to ${outputPath}`,
    );
  } else {
    console.log(output);
  }
}
