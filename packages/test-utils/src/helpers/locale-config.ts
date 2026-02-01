/**
 * Locale configuration helper for Playwright tests
 * Reads default locale from base-config.toml, accepts TEST_LOCALE env override
 * Uses IMPL env var to locate implementation-specific config
 * Note: For repo-wide tests (packages/tests/quality/), IMPL may not be set; use safe defaults
 *
 * INTENT: Provide test utilities with locale-aware configuration.
 * ASSUMPTION: Config is in experiences/{impl}/data/base-config.toml
 *   with default_locale and available_locales fields.
 * BREAKS if: Config path or field names change.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getPaths, getProjectRoot } from './paths.js';

const PROJECT_ROOT = getProjectRoot();

function getImpl(): string {
  // For tests that need IMPL, it should be set
  if (process.env.IMPL) return process.env.IMPL;

  // Fallback: find first implementation (for repo-wide tests)
  const implRoot = path.join(PROJECT_ROOT, 'experiences');
  try {
    const impls = fs.readdirSync(implRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    if (impls.length > 0) return impls[0];
  } catch {
    // fall through to error
  }
  throw new Error('IMPL env var required (e.g., IMPL=my-story npm run test:e2e)');
}

const IMPL = getImpl();
const paths = getPaths(IMPL);
const BASE_CONFIG_PATH = paths.baseConfigPath;

/**
 * Parse default locale from base-config.toml
 */
function getDefaultLocale(): string {
  try {
    const content = fs.readFileSync(BASE_CONFIG_PATH, 'utf-8');
    const match = content.match(/default_locale\s*=\s*"(\w+)"/);
    return match ? match[1] : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Get locale to use (TEST_LOCALE env or default from config)
 */
export function getLocale(): string {
  return process.env.TEST_LOCALE || getDefaultLocale();
}

/**
 * Get locale-aware paths for ink and story files
 */
export function getLocalePaths(locale: string = getLocale()) {
  return {
    locale,
    storyPath: path.join(paths.distDir, locale, 'story.json'),
    inkDir: path.join(paths.inkDir, locale, 'chats'),
    variablesFile: path.join(paths.inkDir, 'variables.ink'),
    projectRoot: PROJECT_ROOT,
  };
}

/**
 * Get all available locales from config
 */
export function getAvailableLocales(): string[] {
  try {
    const content = fs.readFileSync(BASE_CONFIG_PATH, 'utf-8');
    const match = content.match(/available_locales\s*=\s*\[(.*?)\]/);
    if (match) {
      return match[1].match(/"(\w+)"/g)?.map(s => s.replace(/"/g, '')) || ['en'];
    }
    return ['en'];
  } catch {
    return ['en'];
  }
}
