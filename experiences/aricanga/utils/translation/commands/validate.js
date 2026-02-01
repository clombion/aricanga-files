/**
 * validate.js - Check translation file for errors
 *
 * Validates that translations preserve placeholders, learning highlights,
 * and checks for excessive text expansion.
 */

import { existsSync, readFileSync } from 'node:fs';

/**
 * Show help for validate command
 */
function showHelp() {
  console.log(`
validate - Check translation file for errors

USAGE
  node experiences/aricanga/utils/translation/cli.js validate <file> [options]

OPTIONS
      --variables         Check {placeholders} preserved (default: true)
      --length <ratio>    Warn if expansion > ratio (default: 1.5)
      --constraints       Check maxLength constraints (default: true)
  -h, --help              Show this help

CHECKS
  - All {variable} placeholders preserved
  - All ((highlight::source)) markers preserved
  - Text expansion within acceptable ratio
  - No empty translations for non-empty sources
  - Translation length within maxLength constraints

EXAMPLES
  # Validate a JSON file
  node experiences/aricanga/utils/translation/cli.js validate translations.json

  # Custom length ratio
  node experiences/aricanga/utils/translation/cli.js validate fr.json --length 2.0

  # Skip constraint checking
  node experiences/aricanga/utils/translation/cli.js validate fr.json --constraints=false
`);
}

/**
 * Extract placeholders from text
 * @param {string} text - Text to extract from
 * @returns {Set<string>} Set of {placeholder} patterns found
 */
export function extractPlaceholders(text) {
  const placeholders = new Set();
  const regex = /\{(\w+)\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    placeholders.add(match[0]);
  }
  return placeholders;
}

/**
 * Extract learning highlights from text
 * @param {string} text - Text to extract from
 * @returns {Set<string>} Set of ((term::definition)) patterns found
 */
export function extractHighlights(text) {
  const highlights = new Set();
  const regex = /\(\([^)]+::[^)]+\)\)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    highlights.add(match[0]);
  }
  return highlights;
}

/**
 * Parse file content
 */
function parseFile(filePath, content) {
  if (filePath.endsWith('.json')) {
    const json = JSON.parse(content);
    return json.items || json.strings || [];
  }

  // Try to extract JSON from markdown
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    const json = JSON.parse(jsonMatch[1]);
    return json.items || json.strings || [];
  }

  throw new Error('Could not parse file format');
}

/**
 * Run validate command
 */
export async function run(flags, positional) {
  if (flags.help || flags.h) {
    showHelp();
    return;
  }

  const filePath = positional[0];
  const checkVariables = flags.variables !== false;
  const checkConstraints = flags.constraints !== false;
  const lengthRatio = Number.parseFloat(flags.length) || 1.5;

  if (!filePath) {
    console.error('Error: Input file is required');
    console.error('Usage: node experiences/aricanga/utils/translation/cli.js validate <file>');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf-8');

  let items;
  try {
    items = parseFile(filePath, content);
  } catch (error) {
    console.error(`Error parsing file: ${error.message}`);
    process.exit(1);
  }

  console.log(`Validating ${items.length} translation items...`);
  console.log('');

  const errors = [];
  const warnings = [];

  for (const item of items) {
    const source = item.source || '';
    const translation = item.translation || '';

    // Skip items without translations
    if (!translation) continue;

    // Check for missing placeholders
    if (checkVariables) {
      const sourcePlaceholders = extractPlaceholders(source);
      const translationPlaceholders = extractPlaceholders(translation);

      for (const ph of sourcePlaceholders) {
        if (!translationPlaceholders.has(ph)) {
          errors.push({
            id: item.id,
            type: 'missing_placeholder',
            message: `Missing placeholder ${ph}`,
            source,
            translation,
          });
        }
      }

      // Check for added placeholders not in source
      for (const ph of translationPlaceholders) {
        if (!sourcePlaceholders.has(ph)) {
          warnings.push({
            id: item.id,
            type: 'added_placeholder',
            message: `Added placeholder ${ph} not in source`,
          });
        }
      }
    }

    // Check for missing learning highlights
    const sourceHighlights = extractHighlights(source);
    const translationHighlights = extractHighlights(translation);

    for (const hl of sourceHighlights) {
      if (!translationHighlights.has(hl)) {
        errors.push({
          id: item.id,
          type: 'missing_highlight',
          message: `Missing learning highlight ${hl}`,
          source,
          translation,
        });
      }
    }

    // Check text expansion
    if (source.length > 0 && translation.length > 0) {
      const ratio = translation.length / source.length;
      if (ratio > lengthRatio) {
        warnings.push({
          id: item.id,
          type: 'text_expansion',
          message: `Text expanded ${ratio.toFixed(1)}x (>${lengthRatio}x threshold)`,
          sourceLength: source.length,
          translationLength: translation.length,
        });
      }
    }

    // Check for empty translation of non-empty source
    if (source.trim() && !translation.trim()) {
      errors.push({
        id: item.id,
        type: 'empty_translation',
        message: 'Empty translation for non-empty source',
        source,
      });
    }

    // Check maxLength constraints
    if (checkConstraints && item.constraints?.maxLength) {
      const maxLength = item.constraints.maxLength;
      if (translation.length > maxLength) {
        errors.push({
          id: item.id,
          type: 'exceeds_max_length',
          message: `Translation exceeds maxLength (${translation.length}/${maxLength} chars)`,
          uiElement: item.constraints.uiElement,
          translation,
        });
      }
    }
  }

  // Report results
  if (errors.length > 0) {
    console.log(`ERRORS (${errors.length}):`);
    for (const err of errors) {
      console.log(`  ${err.id}: ${err.message}`);
      if (err.source)
        console.log(`    source: "${err.source.slice(0, 50)}..."`);
      if (err.translation)
        console.log(`    translation: "${err.translation.slice(0, 50)}..."`);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`WARNINGS (${warnings.length}):`);
    for (const warn of warnings) {
      console.log(`  ${warn.id}: ${warn.message}`);
    }
    console.log('');
  }

  const translated = items.filter((i) => i.translation).length;
  console.log(`Summary:`);
  console.log(`  Total items: ${items.length}`);
  console.log(`  Translated: ${translated}`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\nValidation FAILED');
    process.exit(1);
  } else {
    console.log('\nValidation PASSED');
  }
}
