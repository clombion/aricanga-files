#!/usr/bin/env node
/**
 * Generate Test Expectations
 *
 * Extracts speaker names, entity names, and character names from TOML config
 * and generates a TypeScript file that tests can import.
 *
 * This ensures tests stay in sync with story configuration without hardcoding.
 *
 * Output: experiences/{impl}/tests/fixtures/generated-expectations.ts
 *
 * Usage:
 *   node utils/build/generate-test-expectations.js
 *
 * Run as part of build:
 *   mise run build (includes this automatically)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import TOML from '@iarna/toml';
import { getPaths, requireImpl } from '../lib/locale-config.js';

// Get implementation from IMPL env var (required)
const IMPL = requireImpl();
const paths = getPaths(IMPL);

const BASE_CONFIG_PATH = paths.baseConfigPath;
const LOCALES_DIR = paths.localesDir;
const OUTPUT_PATH = paths.expectationsOutput;

/**
 * Flatten nested entity structure for simple ID-based lookups
 * e.g., entities.companies.aricanga → aricanga
 */
function flattenEntities(entities) {
  const flat = {};
  for (const category of Object.values(entities || {})) {
    for (const [id, data] of Object.entries(category)) {
      // Only include name-related fields, not context/skip_localization
      const { context, skip_localization, ...nameData } = data;
      flat[id] = nameData;
    }
  }
  return flat;
}

/**
 * Extract name variants from characters in base config
 */
function extractCharacterNames(characters) {
  const names = {};
  const nameFields = ['first_name', 'last_name', 'formal'];

  for (const [id, char] of Object.entries(characters || {})) {
    const charNames = {};
    for (const field of nameFields) {
      if (char[field]) {
        charNames[field] = char[field];
      }
    }
    if (Object.keys(charNames).length > 0) {
      names[id] = charNames;
    }
  }
  return names;
}

/**
 * Extract speaker names for message attribution
 * Uses first_name if available (for people), otherwise display_name (for channels)
 * This matches what ink uses in # speaker: tags
 */
function extractSpeakers(baseCharacters, localeCharacters) {
  const speakers = {};
  for (const [id, char] of Object.entries(localeCharacters || {})) {
    const baseChar = baseCharacters?.[id] || {};
    // For people with first_name, use that (matches ink # speaker: tags)
    // For channels/notes without first_name, use display_name
    // For notes (player's own messages), use null
    if (id === 'notes') {
      speakers[id] = null; // Player's own messages, no speaker
    } else if (baseChar.first_name) {
      speakers[id] = baseChar.first_name;
    } else if (char.display_name) {
      speakers[id] = char.display_name;
    }
  }
  return speakers;
}

/**
 * Serialize object to TypeScript literal
 */
function toTSLiteral(value, indent = 0) {
  const spaces = '  '.repeat(indent);
  const nextSpaces = '  '.repeat(indent + 1);

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);

  if (typeof value === 'string') {
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n');
    return `'${escaped}'`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v) => `${nextSpaces}${toTSLiteral(v, indent + 1)}`);
    return `[\n${items.join(',\n')},\n${spaces}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';

    const entries = keys.map((key) => {
      const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
      const formattedKey = validIdentifier ? key : `'${key}'`;
      return `${nextSpaces}${formattedKey}: ${toTSLiteral(value[key], indent + 1)}`;
    });
    return `{\n${entries.join(',\n')},\n${spaces}}`;
  }

  return String(value);
}

try {
  console.log('Generating test expectations from TOML...');

  // Load base config
  if (!existsSync(BASE_CONFIG_PATH)) {
    throw new Error(`Base config not found: ${BASE_CONFIG_PATH}`);
  }
  const baseContent = readFileSync(BASE_CONFIG_PATH, 'utf-8');
  const baseConfig = TOML.parse(baseContent);

  // Load default locale (en)
  const locale = baseConfig.i18n?.default_locale || 'en';
  const localePath = join(LOCALES_DIR, `${locale}.toml`);
  if (!existsSync(localePath)) {
    throw new Error(`Locale file not found: ${localePath}`);
  }
  const localeContent = readFileSync(localePath, 'utf-8');
  const localeConfig = TOML.parse(localeContent);

  // Extract data
  const speakers = extractSpeakers(baseConfig.characters, localeConfig.characters);
  const entityNames = flattenEntities(baseConfig.entities);
  const characterNames = extractCharacterNames(baseConfig.characters);

  // Merge character display_name into characterNames
  for (const [id, char] of Object.entries(localeConfig.characters || {})) {
    if (char.display_name) {
      characterNames[id] = characterNames[id] || {};
      characterNames[id].display_name = char.display_name;
    }
  }

  // Generate TypeScript
  const ts = `// Generated from experiences/${IMPL}/base-config.toml + locales/en.toml
// Do not edit directly - run: IMPL=${IMPL} node utils/build/generate-test-expectations.js
//
// This file provides type-safe access to story configuration for tests.
// When story content changes, regenerate this file instead of updating tests.

/**
 * Speaker display names by chat ID
 * Use for assertions about who sent a message
 */
export const SPEAKERS = ${toTSLiteral(speakers)} as const;

/**
 * Entity name variants (companies, government bodies, places)
 * Use for assertions about entity references in messages
 */
export const ENTITY_NAMES = ${toTSLiteral(entityNames)} as const;

/**
 * Character name variants
 * Use for assertions about character name references
 */
export const CHARACTER_NAMES = ${toTSLiteral(characterNames)} as const;

// Type helpers
export type ChatId = keyof typeof SPEAKERS;
export type EntityId = keyof typeof ENTITY_NAMES;
export type CharacterId = keyof typeof CHARACTER_NAMES;

/**
 * Get a name variant for an entity or character
 */
export function getName(id: string, variant: string = 'short'): string | undefined {
  const entity = ENTITY_NAMES[id as EntityId];
  if (entity && variant in entity) {
    return entity[variant as keyof typeof entity];
  }

  const character = CHARACTER_NAMES[id as CharacterId];
  if (character && variant in character) {
    return character[variant as keyof typeof character];
  }

  return undefined;
}
`;

  // Ensure output directory exists
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  // Write output
  writeFileSync(OUTPUT_PATH, ts, 'utf-8');

  console.log(`✓ Generated: ${OUTPUT_PATH}`);
  console.log(`  Speakers: ${Object.keys(speakers).length}`);
  console.log(`  Entities: ${Object.keys(entityNames).length}`);
  console.log(`  Characters with names: ${Object.keys(characterNames).length}`);
} catch (error) {
  console.error('Generation failed:', error.message);
  process.exit(1);
}
