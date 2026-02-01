/**
 * Shared utilities for ink linting scripts
 *
 * Centralizes common operations to ensure consistent behavior:
 * - Recursive file scanning
 * - Implementation discovery
 * - Config parsing
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = join(__dirname, '../../..');

/**
 * Recursively find all files matching a pattern in a directory
 * @param {string} dir - Directory to search
 * @param {string} extension - File extension to match (e.g., '.ink')
 * @returns {string[]} Array of absolute file paths
 */
export function findFilesRecursive(dir, extension) {
  const results = [];

  if (!existsSync(dir)) {
    return results;
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesRecursive(fullPath, extension));
    } else if (entry.name.endsWith(extension)) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Find all .ink files in a directory (recursive)
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of absolute file paths
 */
export function findInkFiles(dir) {
  return findFilesRecursive(dir, '.ink');
}

/**
 * Get relative path from a base directory
 * @param {string} fullPath - Absolute path
 * @param {string} baseDir - Base directory to make relative from
 * @returns {string} Relative path
 */
export function relativePath(fullPath, baseDir) {
  return fullPath.replace(baseDir + '/', '');
}

/**
 * Get all implementation directories
 * @returns {Array<{name: string, path: string}>}
 */
export function getImplementations() {
  const implRoot = join(PROJECT_ROOT, 'experiences');

  if (!existsSync(implRoot)) {
    return [];
  }

  return readdirSync(implRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({
      name: d.name,
      path: join(implRoot, d.name),
    }));
}

/**
 * Get the base/default locale from an implementation's config
 * @param {string} configPath - Path to base-config.toml
 * @returns {string} Locale code (defaults to 'en')
 */
export function getBaseLocale(configPath) {
  if (!existsSync(configPath)) {
    return 'en';
  }
  const content = readFileSync(configPath, 'utf-8');
  const match = content.match(/default_locale\s*=\s*["'](\w+)["']/);
  return match ? match[1] : 'en';
}

/**
 * Get available locales from an implementation's config
 * @param {string} configPath - Path to base-config.toml
 * @returns {string[]} Array of locale codes
 */
export function getAvailableLocales(configPath) {
  if (!existsSync(configPath)) {
    return ['en'];
  }
  const content = readFileSync(configPath, 'utf-8');
  const match = content.match(/available_locales\s*=\s*\[([^\]]+)\]/);
  if (!match) return ['en'];

  return match[1]
    .split(',')
    .map(s => s.trim().replace(/["']/g, ''))
    .filter(Boolean);
}

/**
 * Extract knot names from ink content (=== name ===)
 * @param {string} inkContent - Ink file content
 * @returns {string[]} Array of knot names
 */
export function extractKnotNames(inkContent) {
  const matches = inkContent.matchAll(/^===\s*(\w+)\s*===/gm);
  return Array.from(matches, m => m[1]);
}

/**
 * Extract stitch names from ink content (= name)
 * @param {string} inkContent - Ink file content
 * @returns {string[]} Array of stitch names
 */
export function extractStitchNames(inkContent) {
  const matches = inkContent.matchAll(/^=\s*(\w+)\s*$/gm);
  return Array.from(matches, m => m[1]);
}

/**
 * Extract variable declarations from ink content (VAR name = value)
 * @param {string} inkContent - Ink file content
 * @returns {string[]} Array of variable names
 */
export function extractDeclaredVariables(inkContent) {
  const matches = inkContent.matchAll(/^VAR\s+(\w+)\s*=/gm);
  return Array.from(matches, m => m[1]);
}

/**
 * Get ink directories for all locales in an implementation
 * @param {string} implPath - Path to implementation root
 * @returns {Array<{locale: string, path: string}>}
 */
export function getInkLocaleDirectories(implPath) {
  const inkRoot = join(implPath, 'ink');
  const dirs = [];

  if (!existsSync(inkRoot)) {
    return dirs;
  }

  const entries = readdirSync(inkRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      dirs.push({
        locale: entry.name,
        path: join(inkRoot, entry.name),
      });
    }
  }

  return dirs;
}
