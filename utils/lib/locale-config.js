/**
 * locale-config.js - Locale resolution for build scripts and CLI tools
 *
 * Determines active locale from CLI args (--locale=XX) or base-config.toml default.
 * Provides locale-aware paths for ink files, story output, and config.
 *
 * Requires IMPL environment variable to locate implementation-specific config.
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

/**
 * Require IMPL environment variable
 * @throws {Error} If IMPL is not set
 */
export function requireImpl() {
  const impl = process.env.IMPL;
  if (!impl) {
    throw new Error(
      'IMPL env var required. Set IMPL=<implementation-name> (e.g., IMPL=my-story)'
    );
  }
  return impl;
}

/**
 * Get path to locales directory for current implementation
 * @param {string} [impl] - Implementation name (defaults to IMPL env var)
 * @returns {string} Absolute path to locales directory
 */
export function getLocalesDir(impl = requireImpl()) {
  return join(PROJECT_ROOT, 'experiences', impl, 'data/locales');
}

/**
 * Get path to a specific locale file
 * @param {string} locale - Locale code (e.g., 'en', 'fr')
 * @param {string} [impl] - Implementation name (defaults to IMPL env var)
 * @returns {string} Absolute path to locale TOML file
 */
export function getLocalePath(locale, impl = requireImpl()) {
  return join(getLocalesDir(impl), `${locale}.toml`);
}

/**
 * Get path to base config for current implementation
 * @param {string} [impl] - Implementation name (defaults to IMPL env var)
 * @returns {string} Absolute path to base-config.toml
 */
export function getBaseConfigPath(impl = requireImpl()) {
  return join(PROJECT_ROOT, 'experiences', impl, 'data/base-config.toml');
}

/**
 * Get project root path
 * @returns {string} Absolute path to project root
 */
export function getProjectRoot() {
  return PROJECT_ROOT;
}

/**
 * Parse default locale from base-config.toml
 */
function getDefaultLocale() {
  try {
    const configPath = getBaseConfigPath();
    if (!existsSync(configPath)) {
      return 'en';
    }
    const content = readFileSync(configPath, 'utf-8');
    const match = content.match(/default_locale\s*=\s*"(\w+)"/);
    return match ? match[1] : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Parse --locale=XX from CLI arguments
 */
function getLocaleFromArgs() {
  const localeArg = process.argv.find((arg) => arg.startsWith('--locale='));
  if (localeArg) {
    return localeArg.split('=')[1];
  }
  // Also support --locale XX format
  const localeIndex = process.argv.indexOf('--locale');
  if (localeIndex !== -1 && process.argv[localeIndex + 1]) {
    return process.argv[localeIndex + 1];
  }
  return null;
}

/**
 * Get locale to use (CLI override or default from config)
 */
export function getLocale() {
  return getLocaleFromArgs() || getDefaultLocale();
}

/**
 * Get locale-aware paths for ink and story files
 * @param {string} [locale] - Locale code (defaults to resolved locale)
 * @param {string} [impl] - Implementation name (defaults to IMPL env var)
 */
export function getLocalePaths(locale = getLocale(), impl = requireImpl()) {
  const inkBase = join(PROJECT_ROOT, 'experiences', impl, 'ink');
  return {
    locale,
    storyPath: join(PROJECT_ROOT, 'experiences', impl, `src/dist/${locale}/story.json`),
    inkDir: join(inkBase, `${locale}/chats`),
    inkBaseDir: join(inkBase, locale),
    variablesFile: join(inkBase, 'variables.ink'),
    projectRoot: PROJECT_ROOT,
  };
}

/**
 * Get all standard paths for an implementation
 * Single source of truth for build scripts and tests
 * @param {string} [impl] - Implementation name (defaults to IMPL env var)
 * @returns {object} Path definitions object
 */
export function getPaths(impl = requireImpl()) {
  const implDir = join(PROJECT_ROOT, 'experiences', impl);
  const publicDir = join(implDir, 'public');
  const dataDir = join(implDir, 'data');
  const srcDir = join(implDir, 'src');

  return {
    // Root paths
    projectRoot: PROJECT_ROOT,
    implDir,

    // Public dir (Vite copies to dist/ automatically)
    publicDir,
    publicAssetsDir: join(publicDir, 'assets'),
    publicDataDir: join(publicDir, 'data'),

    // Data paths (build inputs — NOT served at runtime)
    dataDir,
    localesDir: join(dataDir, 'locales'),
    baseConfigPath: join(dataDir, 'base-config.toml'),

    // Source paths
    srcDir,
    generatedDir: join(srcDir, 'generated'),
    configOutput: join(srcDir, 'generated/config.js'),

    // CSS paths (inside public/)
    cssDir: join(publicDir, 'css'),
    themeVarsOutput: join(publicDir, 'css/generated/theme-vars.css'),

    // Ink paths
    inkDir: join(implDir, 'ink'),

    // Dist paths (inside public/ — generated story.json, locales)
    distDir: join(publicDir, 'src/dist'),
    localesOutputDir: join(publicDir, 'src/dist/locales'),

    // Test paths
    testsDir: join(implDir, 'tests'),
    fixturesDir: join(implDir, 'tests/fixtures'),
    expectationsOutput: join(implDir, 'tests/fixtures/generated-expectations.ts'),
  };
}
