/**
 * names.js - LLM-assisted name localization suggestions
 *
 * Suggests localized names for characters and entities based on setting context.
 * Uses structured output (generateObject) for reliable JSON responses.
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import TOML from '@iarna/toml';
import { generateObject } from 'ai';
import { z } from 'zod';

import { generateBackupTimestamp } from '../../../../../utils/lib/ink-writer.js';
import { getBaseConfigPath, getLocalePath, getProjectRoot } from '../../../../../utils/lib/locale-config.js';
import {
  getAvailableProviders,
  getProviderConfig,
  getProviderEnvKey,
  isProviderConfigured,
} from '../llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = getProjectRoot();

/**
 * Zod schema for structured name suggestions
 */
const NameSuggestionSchema = z.object({
  characters: z.array(
    z.object({
      id: z.string().describe('Character ID from config'),
      keep: z.boolean().describe('True if names should stay unchanged'),
      rationale: z
        .string()
        .describe('Brief explanation for keep/change decision'),
      names: z
        .object({
          display_name: z.string().optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          formal: z.string().optional(),
        })
        .optional()
        .describe('Suggested name variants (only if keep=false)'),
    }),
  ),
  entities: z.array(
    z.object({
      id: z.string().describe('Entity ID from config'),
      keep: z.boolean().describe('True if names should stay unchanged'),
      rationale: z
        .string()
        .describe('Brief explanation for keep/change decision'),
      names: z
        .object({
          name: z.string().optional(),
          short: z.string().optional(),
          alt: z.string().optional(),
          reference: z.string().optional(),
        })
        .optional()
        .describe('Suggested name variants (only if keep=false)'),
    }),
  ),
});


/**
 * Generate fake name suggestions for testing
 * Marks all items as "keep" to avoid actual changes
 */
function generateFakeSuggestions(characters, entities, type, context) {
  const suggestions = {
    characters: [],
    entities: [],
  };

  if (type === 'all' || type === 'characters') {
    for (const char of characters) {
      suggestions.characters.push({
        id: char.id,
        keep: false,
        rationale: `Fake suggestion for ${context} context`,
        names: {
          display_name: `${char.display_name || char.first_name} [${context}]`,
          first_name: char.first_name
            ? `${char.first_name}[${context}]`
            : undefined,
          formal: char.formal ? `${char.formal} [${context}]` : undefined,
        },
      });
    }
  }

  if (type === 'all' || type === 'entities') {
    for (const entity of entities) {
      if (entity.skip_localization) {
        suggestions.entities.push({
          id: entity.id,
          keep: true,
          rationale: 'Marked skip_localization in config',
        });
      } else {
        suggestions.entities.push({
          id: entity.id,
          keep: false,
          rationale: `Fake suggestion for ${context} context`,
          names: {
            name: entity.name ? `${entity.name} [${context}]` : undefined,
            short: entity.short ? `${entity.short}[${context}]` : undefined,
          },
        });
      }
    }
  }

  return suggestions;
}

/**
 * Show help for names command
 */
function showHelp() {
  const providers = getAvailableProviders().join(', ');
  console.log(`
names - Suggest localized names for characters and entities

USAGE
  node experiences/aricanga/utils/translation/cli.js names [options]

OPTIONS
  --context <hint>    Setting direction (e.g., "French", "cyberpunk", "Martian")
  --locale <code>     Target locale (writes to {locale}.toml with confirmation)
  --type <type>       Filter: "characters", "entities", or "all" (default: all)
  -p, --provider <n>  LLM provider: ${providers} (default: anthropic)
  -m, --model <name>  Model override
      --dry-run       Show changes without writing
      --no-backup     Skip .bak file creation (not recommended)
  -o, --out <path>    Output JSON to file instead of stdout
  -h, --help          Show this help

ENVIRONMENT
  ANTHROPIC_API_KEY            Required for anthropic provider
  GOOGLE_GENERATIVE_AI_API_KEY Required for google provider (free tier available)
  OPENAI_API_KEY               Required for openai provider

EXAMPLES
  # Get French name suggestions
  node experiences/aricanga/utils/translation/cli.js names --context "French"

  # Write to fr.toml (creates backup first)
  node experiences/aricanga/utils/translation/cli.js names --locale fr --context "French"

  # Fantastical setting suggestions
  node experiences/aricanga/utils/translation/cli.js names --context "cyberpunk dystopia"

  # Preview what would change
  node experiences/aricanga/utils/translation/cli.js names --locale fr --context "French" --dry-run

  # Only characters
  node experiences/aricanga/utils/translation/cli.js names --context "French" --type characters
`);
}

/**
 * Load base config to extract entities and characters
 */
function loadBaseConfig() {
  const configPath = getBaseConfigPath();
  if (!existsSync(configPath)) {
    throw new Error(`base-config.toml not found at ${configPath}. Check IMPL env var.`);
  }

  const content = readFileSync(configPath, 'utf-8');
  return TOML.parse(content);
}

/**
 * Extract character data for LLM prompt
 */
function extractCharacters(config) {
  const characters = [];

  for (const [id, char] of Object.entries(config.characters || {})) {
    // Skip characters without name fields
    const hasNameFields =
      char.first_name || char.last_name || char.formal || char.display_name;
    if (!hasNameFields) continue;

    characters.push({
      id,
      current: {
        display_name: char.display_name,
        first_name: char.first_name,
        last_name: char.last_name,
        formal: char.formal,
      },
      context: char.personality || char.story_role || '',
    });
  }

  return characters;
}

/**
 * Extract entity data for LLM prompt
 */
function extractEntities(config) {
  const entities = [];

  for (const [_category, categoryEntities] of Object.entries(
    config.entities || {},
  )) {
    for (const [id, entity] of Object.entries(categoryEntities)) {
      entities.push({
        id,
        current: {
          name: entity.name,
          short: entity.short,
          alt: entity.alt,
          reference: entity.reference,
        },
        context: entity.context || '',
        skip_localization: entity.skip_localization || false,
      });
    }
  }

  return entities;
}

/**
 * Build system prompt for name suggestions
 */
function buildSystemPrompt(settingContext) {
  return `You are helping localize a narrative game. Based on the setting context provided, suggest appropriate name localizations for characters and entities.

SETTING CONTEXT: ${settingContext}

GUIDELINES:
1. For entities marked with skip_localization: true, set keep=true
2. Consider cultural appropriateness and authenticity
3. Maintain narrative consistency - names should fit the story role
4. For formal variants, use appropriate honorifics for the setting
5. Keep names pronounceable in the target setting
6. Preserve character distinctiveness - names should be memorable and distinguishable

Provide structured suggestions with rationale for each decision.`;
}

/**
 * Build user prompt with character/entity data
 */
function buildUserPrompt(characters, entities, type) {
  const data = {};

  if (type === 'all' || type === 'characters') {
    data.characters = characters;
  }

  if (type === 'all' || type === 'entities') {
    data.entities = entities;
  }

  return `Analyze these names and suggest localizations:

${JSON.stringify(data, null, 2)}

For each item:
- Set keep=true if the name should remain unchanged (with rationale)
- Set keep=false and provide suggested names if localization is appropriate`;
}

/**
 * Get provider instance
 */
function getProvider(providerName, modelOverride) {
  const provider = getProviderConfig(providerName);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  if (provider.envKey && !process.env[provider.envKey]) {
    throw new Error(`Missing ${provider.envKey} environment variable`);
  }

  return provider.factory(modelOverride || provider.defaultModel);
}

/**
 * Format suggestions as TOML additions
 */
function formatAsToml(suggestions) {
  const tomlData = { names: { characters: {}, entities: {} } };

  for (const char of suggestions.characters || []) {
    if (!char.keep && char.names) {
      tomlData.names.characters[char.id] = char.names;
    }
  }

  for (const entity of suggestions.entities || []) {
    if (!entity.keep && entity.names) {
      tomlData.names.entities[entity.id] = entity.names;
    }
  }

  // Clean up empty sections
  if (Object.keys(tomlData.names.characters).length === 0) {
    delete tomlData.names.characters;
  }
  if (Object.keys(tomlData.names.entities).length === 0) {
    delete tomlData.names.entities;
  }
  if (Object.keys(tomlData.names).length === 0) {
    return null;
  }

  return tomlData.names;
}

/**
 * Run names command
 */
export async function run(flags, _positional) {
  if (flags.help || flags.h) {
    showHelp();
    return;
  }

  const settingContext = flags.context;
  const targetLocale = flags.locale || flags.l;
  const providerName = flags.provider || flags.p || 'anthropic';
  const modelOverride = flags.model || flags.m;
  const type = flags.type || 'all';
  const dryRun = flags['dry-run'] || false;
  const noBackup = flags['no-backup'] || false;
  const outputPath = flags.out || flags.o;

  if (!settingContext) {
    console.error('Error: --context is required');
    console.error('Example: --context "French" or --context "cyberpunk"');
    console.error('Run with --help for usage.');
    process.exit(1);
  }

  // Validate type
  if (!['all', 'characters', 'entities'].includes(type)) {
    console.error(
      `Error: Invalid --type "${type}". Use: all, characters, entities`,
    );
    process.exit(1);
  }

  // Check API key (skip for fake provider)
  if (providerName !== 'fake' && !isProviderConfigured(providerName)) {
    const envKey = getProviderEnvKey(providerName) || 'API_KEY';
    console.error(`Error: Missing ${envKey} environment variable`);
    process.exit(1);
  }

  // Load config
  console.error('Loading base config...');
  const config = loadBaseConfig();
  const characters = extractCharacters(config);
  const entities = extractEntities(config);

  const itemCount =
    (type === 'all' || type === 'characters' ? characters.length : 0) +
    (type === 'all' || type === 'entities' ? entities.length : 0);

  if (itemCount === 0) {
    console.error('No items to process.');
    return;
  }

  console.error(
    `Found ${characters.length} characters, ${entities.length} entities`,
  );
  console.error(`Setting context: "${settingContext}"`);
  console.error(
    `Provider: ${providerName}${modelOverride ? ` (${modelOverride})` : ''}`,
  );
  console.error('');

  // Generate suggestions
  console.error('Generating name suggestions...');

  let suggestions;
  if (providerName === 'fake') {
    // Use fake provider for testing
    suggestions = generateFakeSuggestions(
      characters,
      entities,
      type,
      settingContext,
    );
  } else {
    const provider = getProvider(providerName, modelOverride);
    const { object } = await generateObject({
      model: provider,
      schema: NameSuggestionSchema,
      system: buildSystemPrompt(settingContext),
      prompt: buildUserPrompt(characters, entities, type),
    });
    suggestions = object;
  }

  // Format output
  const tomlAdditions = formatAsToml(suggestions);

  // Count changes
  const charChanges =
    suggestions.characters?.filter((c) => !c.keep).length || 0;
  const entityChanges =
    suggestions.entities?.filter((e) => !e.keep).length || 0;
  const totalChanges = charChanges + entityChanges;

  console.error('');
  console.error(
    `Suggestions: ${totalChanges} changes, ${itemCount - totalChanges} kept`,
  );

  // Output results
  if (outputPath) {
    const output = {
      metadata: {
        context: settingContext,
        provider: providerName,
        generated: new Date().toISOString(),
      },
      suggestions,
      toml: tomlAdditions,
    };
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.error(`Wrote suggestions to ${outputPath}`);
    return;
  }

  if (targetLocale) {
    const localePath = getLocalePath(targetLocale);

    if (dryRun) {
      console.error('');
      console.error(`DRY RUN - Would add to ${localePath}:`);
      console.error('');
      if (tomlAdditions) {
        console.log(TOML.stringify(tomlAdditions));
      } else {
        console.log('# No changes needed');
      }
      return;
    }

    if (!tomlAdditions) {
      console.error('No changes to write.');
      return;
    }

    // Create backup with timestamp to avoid overwriting previous backups
    if (!noBackup && existsSync(localePath)) {
      const timestamp = generateBackupTimestamp();
      const backupPath = `${localePath}.${timestamp}.bak`;
      copyFileSync(localePath, backupPath);
      console.error(`Backup: ${backupPath}`);
    }

    // Load existing locale file
    let localeConfig = {};
    if (existsSync(localePath)) {
      const content = readFileSync(localePath, 'utf-8');
      localeConfig = TOML.parse(content);
    }

    // Merge name additions
    localeConfig.names = {
      ...(localeConfig.names || {}),
      characters: {
        ...(localeConfig.names?.characters || {}),
        ...(tomlAdditions.characters || {}),
      },
      entities: {
        ...(localeConfig.names?.entities || {}),
        ...(tomlAdditions.entities || {}),
      },
    };

    // Clean up empty sections
    if (Object.keys(localeConfig.names.characters).length === 0) {
      delete localeConfig.names.characters;
    }
    if (Object.keys(localeConfig.names.entities).length === 0) {
      delete localeConfig.names.entities;
    }

    // Write updated locale file
    writeFileSync(localePath, TOML.stringify(localeConfig));
    console.error(`Updated: ${localePath}`);
  } else {
    // Output JSON to stdout
    const output = {
      metadata: {
        context: settingContext,
        provider: providerName,
        generated: new Date().toISOString(),
      },
      suggestions,
      toml: tomlAdditions,
    };
    console.log(JSON.stringify(output, null, 2));
  }
}
