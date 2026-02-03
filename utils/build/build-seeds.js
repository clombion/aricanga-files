#!/usr/bin/env node
/**
 * Build Seeds - Extract seed messages from compiled ink at build time
 *
 * Seeds are backstory messages that appear BEFORE # story_start in each chat.
 * Extracting them at build time:
 * 1. Makes them available immediately on fresh game start
 * 2. Avoids runtime ink processing for static content
 * 3. Ensures seeds never trigger notifications (marked with _isSeed: true)
 *
 * Usage:
 *   IMPL=<name> node utils/build/build-seeds.js [options]
 *
 * Options:
 *   --help, -h     Show help
 *   --verbose, -v  Show detailed output
 *
 * Environment:
 *   IMPL    REQUIRED - Implementation name (e.g., 'aricanga')
 *   LOCALE  Build seeds for specific locale (default: from base-config.toml)
 *
 * Output:
 *   experiences/{impl}/src/generated/seeds.js
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createBuildExternalFunctions,
  bindExternalFunctions,
} from '../../packages/framework/src/systems/conversation/ink/external-functions.js';
import { getPaths } from '../lib/locale-config.js';

// CLI arguments
const ARGS = {
  help: process.argv.includes('--help') || process.argv.includes('-h'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
};

if (ARGS.help) {
  console.log(`
build-seeds.js - Extract seed messages from compiled ink

USAGE
  IMPL=<name> node utils/build/build-seeds.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show detailed output

ENVIRONMENT
  IMPL    REQUIRED - Implementation name (e.g., 'aricanga')
  LOCALE  Build seeds for specific locale (default: from config)

OUTPUT
  experiences/{impl}/src/generated/seeds.js

Seeds are messages before # story_start in each chat knot.
They're extracted at build time and marked with _isSeed: true
to prevent notification triggers at runtime.
`);
  process.exit(0);
}

const IMPL = process.env.IMPL;
if (!IMPL) {
  console.error('Error: IMPL environment variable required');
  console.error('Usage: IMPL=aricanga node utils/build/build-seeds.js');
  process.exit(1);
}

// Paths (from centralized locale-config)
const paths = getPaths(IMPL);
const STORY_PATH = join(paths.distDir, 'en/story.json'); // Default to 'en'
const CONFIG_PATH = paths.configOutput;
const LOCALE_PATH = join(paths.localesOutputDir, 'en.json');
const OUTPUT_PATH = join(paths.generatedDir, 'seeds.js');

// ID counter for deterministic seed IDs
let seedIdCounter = 0;

/**
 * Generate a deterministic seed ID
 * @param {string} chatId - Chat identifier
 * @returns {string}
 */
function generateSeedId(chatId) {
  return `seed-${chatId}-${++seedIdCounter}`;
}

/**
 * Parse ink tags into key-value object (simplified version of parseTags)
 * @param {string[]} tags - Array of tag strings
 * @returns {Object}
 */
function parseTags(tags) {
  const result = {};
  if (!tags) return result;

  for (const tag of tags) {
    const colonIdx = tag.indexOf(':');
    if (colonIdx === -1) {
      result[tag.trim()] = true;
    } else {
      const key = tag.slice(0, colonIdx).trim();
      const value = tag.slice(colonIdx + 1).trim();
      result[key] = value;
    }
  }
  return result;
}

/**
 * Create a seed message object
 * @param {string} chatId - Chat ID
 * @param {string} text - Message text
 * @param {Object} tags - Parsed tags
 * @returns {Object} Seed message
 */
function createSeedMessage(chatId, text, tags) {
  const type = tags.type || 'received';
  const msg = {
    id: generateSeedId(chatId),
    text,
    type,
    kind: 'text',
    _isSeed: true, // Critical: prevents notifications
    timestamp: 0, // deterministic — seeds are pre-existing backstory, real time doesn't matter
    receipt: type === 'sent' ? 'delivered' : 'none',
  };

  // Add optional fields from tags
  if (tags.speaker) msg.speaker = tags.speaker;
  if (tags.time) msg.time = tags.time;
  if (tags.date) msg.date = tags.date;

  // Handle audio messages
  if (tags.audio) {
    msg.kind = 'audio';
    msg.audioSrc = tags.audio;
    msg.duration = tags.duration || '0:00';
    msg.transcript = text;
    msg.transcriptRevealed = false;
  }

  // Handle link preview (attached to text message)
  // Note: ink treats // as comments, so linkUrl should use bare domain paths
  // (e.g., "globalwitness.org/en/"). Protocol is prepended automatically here.
  // Internal links like "glossary:soe-database" are passed through unchanged.
  if (tags.linkUrl) {
    let url = tags.linkUrl;
    if (!url.includes(':')) {
      url = `https://${url}`;
    }
    const linkPreview = { url };
    if (tags.linkDomain) linkPreview.domain = tags.linkDomain;
    if (tags.linkTitle) linkPreview.title = tags.linkTitle;
    if (tags.linkDesc) linkPreview.description = tags.linkDesc;
    if (tags.linkImage) linkPreview.imageSrc = tags.linkImage;
    if (tags.linkLayout) linkPreview.layout = tags.linkLayout;
    msg.linkPreview = linkPreview;
  }

  // Handle image messages
  if (tags.image) {
    msg.kind = 'image';
    msg.imageSrc = tags.image;
    msg.caption = text || undefined;
  }

  return msg;
}

/**
 * Extract seeds from a single chat knot
 * @param {Object} story - inkjs Story instance
 * @param {string} chatId - Chat ID
 * @param {string} knotName - Ink knot name
 * @param {Object} names - Name lookup table
 * @returns {Object[]} Array of seed messages
 */
function extractChatSeeds(story, chatId, knotName, names) {
  const seeds = [];

  try {
    // Navigate to the chat knot
    story.ChoosePathString(knotName);
  } catch (e) {
    if (ARGS.verbose) {
      console.log(`  Skipping ${chatId}: knot "${knotName}" not found`);
    }
    return seeds;
  }

  // Process until we hit story_start or can't continue
  while (story.canContinue) {
    const text = story.Continue().trim();
    const tags = parseTags(story.currentTags);

    // Stop at story_start boundary
    if (tags.story_start !== undefined) {
      if (ARGS.verbose) {
        console.log(`  ${chatId}: hit story_start after ${seeds.length} seeds`);
      }
      break;
    }

    // Skip empty lines (logic-only)
    if (!text) continue;

    // Create seed message
    const seed = createSeedMessage(chatId, text, tags);
    seeds.push(seed);

    // Clear any captured delay (we don't need delays for seeds)
    story._capturedDelay = 0;
  }

  return seeds;
}

/**
 * Main build function
 */
async function main() {
  console.log('Extracting seeds from compiled ink...\n');

  // Validate paths
  if (!existsSync(STORY_PATH)) {
    console.error(`Error: Compiled story not found at ${STORY_PATH}`);
    console.error('Run: mise run build:ink');
    process.exit(1);
  }

  if (!existsSync(CONFIG_PATH)) {
    console.error(`Error: Config not found at ${CONFIG_PATH}`);
    console.error('Run: mise run build:config');
    process.exit(1);
  }

  // Load story JSON
  const storyJson = JSON.parse(readFileSync(STORY_PATH, 'utf-8'));

  // Load config to get CHATS
  const config = await import(CONFIG_PATH);
  const CHATS = config.CHATS;

  // Load locale for names (if available)
  let names = {};
  if (existsSync(LOCALE_PATH)) {
    const localeData = JSON.parse(readFileSync(LOCALE_PATH, 'utf-8'));
    names = { ...(localeData.baseNames || {}), ...(localeData.names || {}) };
  }

  // Import inkjs dynamically (ESM)
  const { Story } = await import('inkjs');

  // Create story instance
  const story = new Story(storyJson);

  // Bind external functions using shared module (CQO-27)
  // Creates minimal build-time functions: name(), data(), delay_next() capture
  // No-ops for: play_sound(), advance_day(), request_data()
  const externalFunctions = createBuildExternalFunctions({
    getName: (id, variant = 'short') => {
      // Try to look up from locale data
      return names[id]?.[variant] || names[id]?.short || names[id]?.name || id;
    },
    story, // For delay capture
  });
  bindExternalFunctions(story, externalFunctions);

  // Extract seeds for each chat
  const seeds = {};
  const savedState = story.state.ToJson();

  for (const [chatId, chatConfig] of Object.entries(CHATS)) {
    // Skip disappearing chats - they have no seeds
    if (chatConfig.chatType === 'disappearing') {
      if (ARGS.verbose) {
        console.log(`  Skipping ${chatId}: disappearing chat type`);
      }
      continue;
    }

    // Reset story state before each chat
    story.state.LoadJson(savedState);
    seedIdCounter = 0; // Reset counter for deterministic IDs per chat

    // Extract seeds
    const chatSeeds = extractChatSeeds(
      story,
      chatId,
      chatConfig.knotName,
      names,
    );
    seeds[chatId] = chatSeeds;

    console.log(`  ${chatId}: ${chatSeeds.length} seeds`);
  }

  // Generate output
  const output = `// Generated by build-seeds.js - DO NOT EDIT
// Run: mise run build:seeds
// Seeds are backstory messages that appear before # story_start

export const SEEDS = ${JSON.stringify(seeds, null, 2)};
`;

  // Ensure output directory exists
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  // Write output
  writeFileSync(OUTPUT_PATH, output, 'utf-8');

  console.log(`\n✓ Seeds extracted to ${OUTPUT_PATH}`);
  console.log(`  Total: ${Object.values(seeds).flat().length} seed messages`);
}

main().catch((e) => {
  console.error('Build failed:', e);
  process.exit(1);
});
