#!/usr/bin/env node
/**
 * Translation CLI - Extract, import, and manage translations
 *
 * Usage:
 *   node experiences/aricanga/utils/translation/cli.js <command> [options]
 *
 * Commands:
 *   extract   Generate translation payload for LLM/Crowdin
 *   import    Apply translations from file
 *   status    Show translation progress
 *   validate  Check translation file for errors
 *   init      Initialize new locale
 *   check     Detailed locale completeness check
 *   translate LLM-powered translation
 *   names     Suggest localized names for characters/entities
 *
 * Run with --help for detailed options.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Available commands
const COMMANDS = {
  extract: () => import('./commands/extract.js'),
  import: () => import('./commands/import.js'),
  status: () => import('./commands/status.js'),
  validate: () => import('./commands/validate.js'),
  init: () => import('./commands/init.js'),
  check: () => import('./commands/check.js'),
  translate: () => import('./commands/translate.js'),
  names: () => import('./commands/names.js'),
};

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const result = {
    command: null,
    flags: {},
    positional: [],
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) {
        result.flags[key] = value;
      } else if (args[i + 1] && !args[i + 1].startsWith('-')) {
        result.flags[key] = args[i + 1];
        i++;
      } else {
        result.flags[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        result.flags[key] = args[i + 1];
        i++;
      } else {
        result.flags[key] = true;
      }
    } else if (!result.command) {
      result.command = arg;
    } else {
      result.positional.push(arg);
    }
    i++;
  }

  return result;
}

/**
 * Show main help
 */
function showHelp() {
  console.log(`
Translation CLI - Manage translations for ink narrative game

USAGE
  node experiences/aricanga/utils/translation/cli.js <command> [options]
  mise run tl                           # shortcut for extract

COMMANDS
  extract     Generate translation payload
  import      Apply translations from file
  status      Show translation progress
  validate    Check translation file
  init        Initialize new locale
  check       Detailed locale completeness check
  translate   LLM-powered translation (requires API key)
  names       Suggest localized names for characters/entities

OPTIONS
  --help, -h  Show help (use after command for details)

EXAMPLES
  # Extract French strings for LLM translation
  node experiences/aricanga/utils/translation/cli.js extract -l fr -f prompt > fr.txt

  # Import translated JSON
  node experiences/aricanga/utils/translation/cli.js import -l fr translations.json

  # Check translation progress
  node experiences/aricanga/utils/translation/cli.js status

  # Initialize Spanish locale
  node experiences/aricanga/utils/translation/cli.js init es

For command-specific help:
  node experiences/aricanga/utils/translation/cli.js extract --help
`);
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Show help if no command or --help flag
  if (!args.command || args.flags.help || args.flags.h) {
    if (!args.command) {
      showHelp();
      process.exit(0);
    }
  }

  // Check if command exists
  if (!COMMANDS[args.command]) {
    console.error(`Unknown command: ${args.command}`);
    console.error('Run with --help to see available commands.');
    process.exit(1);
  }

  // Load and run command
  try {
    const commandModule = await COMMANDS[args.command]();
    await commandModule.run(args.flags, args.positional);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (args.flags.verbose || args.flags.v) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
