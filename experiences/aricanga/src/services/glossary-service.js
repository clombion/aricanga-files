// Glossary Service - Loads and provides access to glossary terms

import { i18n } from './i18n.js';

/**
 * @typedef {Object} GlossaryTermBase
 * @property {string} id - Unique identifier (e.g., "eiti")
 * @property {string} category - Category for grouping (e.g., "governance")
 */

/**
 * @typedef {Object} GlossaryTerm
 * @property {string} id - Unique identifier (e.g., "eiti")
 * @property {string} term - Display name (e.g., "EITI")
 * @property {string} definition - Full definition text
 * @property {string} category - Category for grouping (e.g., "governance")
 */

/** @type {GlossaryTermBase[]} */
let baseTerms = [];
let loaded = false;

/**
 * Build a full term object from base data using i18n for translatable strings
 * @param {GlossaryTermBase} base
 * @returns {GlossaryTerm}
 */
function buildTerm(base) {
  return {
    id: base.id,
    category: base.category,
    term: i18n.t(`glossary.terms.${base.id}.term`) || base.id,
    definition: i18n.t(`glossary.terms.${base.id}.definition`) || '',
  };
}

/**
 * Load glossary base data from TOML file
 * @param {string} tomlPath - Path to glossary-terms.toml
 * @returns {Promise<void>}
 */
export async function loadGlossary(tomlPath = './data/glossary-terms.toml') {
  if (loaded) return;

  const tomlText = await fetch(tomlPath).then((r) => r.text());
  baseTerms = parseGlossaryToml(tomlText);
  loaded = true;
}

/**
 * Get all glossary terms (with current locale translations)
 * @returns {GlossaryTerm[]}
 */
export function getAllTerms() {
  return baseTerms.map(buildTerm);
}

/**
 * Get a term by ID (with current locale translation)
 * @param {string} id - Term ID
 * @returns {GlossaryTerm|undefined}
 */
export function getTerm(id) {
  const base = baseTerms.find((t) => t.id === id);
  return base ? buildTerm(base) : undefined;
}

/**
 * Search terms by query string (matches term or definition in current locale)
 * @param {string} query - Search query
 * @returns {GlossaryTerm[]}
 */
export function searchTerms(query) {
  const terms = getAllTerms();
  if (!query) return terms;
  const lower = query.toLowerCase();
  return terms.filter(
    (t) =>
      t.term.toLowerCase().includes(lower) ||
      t.definition.toLowerCase().includes(lower),
  );
}

/**
 * Get terms grouped by category (with current locale translations)
 * @returns {Object.<string, GlossaryTerm[]>}
 */
export function getTermsByCategory() {
  const grouped = {};
  for (const term of getAllTerms()) {
    const cat = term.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(term);
  }
  return grouped;
}

/**
 * Parse TOML array-of-tables format for glossary
 * Supports [[terms]] sections with key = "value" pairs
 * @param {string} text - TOML content
 * @returns {GlossaryTermBase[]}
 */
function parseGlossaryToml(text) {
  const result = [];
  let currentTerm = null;

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Array table header: [[terms]]
    if (trimmed === '[[terms]]') {
      if (currentTerm) {
        result.push(currentTerm);
      }
      currentTerm = { id: '', category: '' };
      continue;
    }

    // Key-value pair within current term
    if (currentTerm) {
      const kvMatch = trimmed.match(/^(\w+)\s*=\s*"(.*)"\s*$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        // Only store base fields (id, category)
        if (key === 'id' || key === 'category') {
          currentTerm[key] = value;
        }
      }
    }
  }

  // Don't forget the last term
  if (currentTerm) {
    result.push(currentTerm);
  }

  return result;
}
