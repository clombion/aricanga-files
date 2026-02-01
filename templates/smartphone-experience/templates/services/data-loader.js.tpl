// Data Loader - Loads external data queries from TOML and fetches on startup
// Raw formatted values are returned; ink authors control highlighting with ((value::source)) syntax

import { dataService } from './data-service.js';
import { formatCurrency } from './format.js';

/**
 * Load external data queries from TOML and fetch all on startup
 * Returns a map of variable names to formatted values (ink authors wrap with highlight markers)
 * @param {string} tomlPath - Path to the TOML config file
 * @returns {Promise<Object.<string, string>>} Map of variable names to formatted values
 */
export async function loadExternalData(tomlPath = './data/data-queries.toml') {
  const tomlText = await fetch(tomlPath).then((r) => r.text());
  const queries = parseToml(tomlText);

  const results = {};

  for (const [varName, config] of Object.entries(queries)) {
    try {
      const data = await dataService.fetch(
        config.source,
        config.query,
        config.params,
      );

      if (data.found && config.field in data) {
        const value = data[config.field];
        // Format numeric values for human-readable display
        // Ink authors wrap with ((value::source)) markers to control highlighting
        const formatted =
          typeof value === 'number' ? formatCurrency(value) : String(value);
        results[varName] = formatted;
      }
    } catch (error) {
      console.warn(`Failed to load external data for ${varName}:`, error);
    }
  }

  return results;
}

/**
 * Simple TOML parser for our subset format
 * Supports sections like [varname] with key = "value" pairs
 * @param {string} text - TOML content
 * @returns {Object} Parsed configuration
 */
function parseToml(text) {
  const result = {};
  let currentSection = null;

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Section header: [section_name]
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      result[currentSection] = {};
      continue;
    }

    // Key-value pair: key = "value" or key = value
    if (currentSection) {
      const kvMatch = trimmed.match(/^(\w+)\s*=\s*"?([^"]*)"?$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        result[currentSection][key] = value;
      }
    }
  }

  return result;
}
