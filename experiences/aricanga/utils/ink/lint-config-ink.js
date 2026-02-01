#!/usr/bin/env node

/**
 * lint-config-ink.js - Validate TOML config consistency with ink files
 *
 * Checks:
 * - Chat knotName references exist in ink files
 * - chatType references valid types
 * - Chat ink files have # story_start marker
 * - Required config sections exist
 *
 * Usage:
 *   node utils/linting/ink/lint-config-ink.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show detailed validation
 *
 * Exit codes:
 *   0 - All config/ink mappings valid
 *   1 - Validation errors found
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  findInkFiles,
  getImplementations,
  getBaseLocale,
  extractKnotNames,
  extractDeclaredVariables,
  relativePath,
} from '../../../../utils/linting/lib/ink-utils.js';
import { getPaths } from '../../../../utils/lib/locale-config.js';

// Parse CLI arguments
const ARGS = {
  help: process.argv.includes('--help') || process.argv.includes('-h'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
};

/**
 * Print help message and exit
 */
function showHelp() {
  console.log(`
lint-config-ink.js - Validate TOML config consistency with ink files

USAGE
  node utils/linting/ink/lint-config-ink.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show detailed validation

CHECKS
  • knotName in chat config exists in ink files
  • chatType references valid type
  • Chat ink files have # story_start marker
  • All required config sections exist

WHY THIS MATTERS
  Config/ink mismatches cause runtime errors or broken navigation.

EXIT CODES
  0  All config/ink mappings valid
  1  Validation errors found

EXAMPLES
  node utils/linting/ink/lint-config-ink.js         # Quick lint
  node utils/linting/ink/lint-config-ink.js -v      # Verbose output
`);
  process.exit(0);
}

/**
 * Parse CHATS from generated config.js
 */
function parseChatsFromConfig(configContent) {
  const match = configContent.match(/export const CHATS = ({[\s\S]*?});/);
  if (!match) return {};
  try {
    return eval(`(${match[1]})`);
  } catch {
    return {};
  }
}

/**
 * Parse CHAT_TYPES from generated config.js
 */
function parseChatTypesFromConfig(configContent) {
  const match = configContent.match(/export const CHAT_TYPES = ({[\s\S]*?});/);
  if (!match) return {};
  try {
    return eval(`(${match[1]})`);
  } catch {
    return {};
  }
}


/**
 * Lint a single implementation
 */
function lintImplementation(implName) {
  const errors = [];
  const paths = getPaths(implName);
  const generatedConfigPath = paths.configOutput;
  const baseConfigPath = paths.baseConfigPath;
  const inkRoot = paths.inkDir;
  const variablesPath = join(inkRoot, 'variables.ink');

  // Check generated config exists
  if (!existsSync(generatedConfigPath)) {
    if (ARGS.verbose) {
      console.log(`  ${implName}: skipping (no generated config, run build first)`);
    }
    return errors;
  }

  const configContent = readFileSync(generatedConfigPath, 'utf-8');
  const chats = parseChatsFromConfig(configContent);
  const chatTypes = parseChatTypesFromConfig(configContent);

  if (Object.keys(chats).length === 0) {
    if (ARGS.verbose) {
      console.log(`  ${implName}: no CHATS found in config`);
    }
    return errors;
  }

  // Get locale for ink directory
  const baseLocale = existsSync(baseConfigPath) ? getBaseLocale(baseConfigPath) : 'en';
  const inkDir = join(inkRoot, baseLocale);

  if (!existsSync(inkDir)) {
    errors.push(`${implName}: ink directory not found: ${inkDir}`);
    return errors;
  }

  // Collect all knot names from ink files (recursive)
  const allKnots = [];
  const inkFiles = findInkFiles(inkDir);

  for (const filePath of inkFiles) {
    const content = readFileSync(filePath, 'utf-8');
    allKnots.push(...extractKnotNames(content));
  }

  // Get declared variables
  let declaredVars = [];
  if (existsSync(variablesPath)) {
    const variablesContent = readFileSync(variablesPath, 'utf-8');
    declaredVars = extractDeclaredVariables(variablesContent);
  }

  const validTypes = Object.keys(chatTypes);
  const configKnots = Object.values(chats).map(c => c.knotName);

  if (ARGS.verbose) {
    console.log(`\n${implName}: ${Object.keys(chats).length} chats, ${allKnots.length} knots, ${declaredVars.length} variables`);
  }

  // Validate each chat configuration
  for (const [chatId, config] of Object.entries(chats)) {
    // CONFIG-1: knotName exists in ink
    if (!allKnots.includes(config.knotName)) {
      errors.push(`${implName}/${chatId}: knotName "${config.knotName}" not found in ink`);
    }

    // CONFIG-6: chatType references valid type
    if (!validTypes.includes(config.chatType)) {
      errors.push(`${implName}/${chatId}: chatType "${config.chatType}" not in valid types [${validTypes.join(', ')}]`);
    }

    // CONFIG-7: disappearing chats have required duration
    if (config.chatType === 'disappearing' && !config.disappearingDuration) {
      errors.push(`${implName}/${chatId}: disappearing chat missing duration`);
    }

    // CONFIG-8: all chats have resolvable system message
    const typeConfig = chatTypes[config.chatType];
    if (!config.systemMessage && !typeConfig?.systemMessage) {
      errors.push(`${implName}/${chatId}: no system message resolvable`);
    }

    // CONFIG-11: avatars have required properties
    if (!config.avatarLetter) {
      errors.push(`${implName}/${chatId}: missing avatarLetter`);
    }
    if (!config.avatarColor) {
      errors.push(`${implName}/${chatId}: missing avatarColor`);
    }
  }

  // CONFIG-3: ink chat files have matching TOML entry
  for (const filePath of inkFiles) {
    if (filePath.endsWith('variables.ink')) continue;
    const content = readFileSync(filePath, 'utf-8');
    const knots = extractKnotNames(content);
    const relPath = relativePath(filePath, inkDir);
    for (const knot of knots) {
      if (knot.endsWith('_chat') && !configKnots.includes(knot)) {
        errors.push(`${implName}/${relPath}: knot "${knot}" has no TOML entry`);
      }
    }
  }

  // Check chat ink files have # story_start marker
  for (const [chatId, config] of Object.entries(chats)) {
    for (const filePath of inkFiles) {
      if (filePath.endsWith('variables.ink')) continue;
      const content = readFileSync(filePath, 'utf-8');
      const relPath = relativePath(filePath, inkDir);
      if (content.includes(`=== ${config.knotName} ===`) && !content.includes('# story_start')) {
        errors.push(`${implName}/${relPath} (${chatId}): missing # story_start marker`);
        break;
      }
    }
  }

  return errors;
}

/**
 * Main entry point
 */
function main() {
  if (ARGS.help) {
    showHelp();
  }

  console.log('Linting config/ink mappings...\n');

  const impls = getImplementations();

  if (impls.length === 0) {
    console.log('No implementations directory found.');
    process.exit(0);
  }

  let totalErrors = 0;

  for (const impl of impls) {
    const errors = lintImplementation(impl.name);

    if (errors.length > 0) {
      for (const err of errors) {
        console.log(`ERROR: ${err}`);
      }
      totalErrors += errors.length;
    } else if (ARGS.verbose) {
      console.log(`✓ ${impl.name}: all config/ink mappings valid`);
    }
  }

  // Summary
  console.log('');
  if (totalErrors > 0) {
    console.log(`Found ${totalErrors} config/ink mapping error(s).`);
    process.exit(1);
  } else {
    console.log(`All config/ink mappings valid (${impls.length} implementation(s) checked).`);
    process.exit(0);
  }
}

main();
