/**
 * locale-config.ts - IMPL-aware path helpers for tests
 *
 * Re-exports from packages/test-utils for backward compatibility.
 * New code should import directly from packages/test-utils/src/helpers/paths.ts
 */

import { join } from 'path';
import { getPaths, getProjectRoot as _getProjectRoot } from '../../../packages/test-utils/src/helpers/paths.js';

/**
 * Require IMPL environment variable
 * @throws {Error} If IMPL is not set
 */
export function requireImpl(): string {
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
 */
export function getLocalesDir(): string {
  return getPaths(requireImpl()).localesDir;
}

/**
 * Get path to a specific locale file
 */
export function getLocalePath(locale: string): string {
  return join(getLocalesDir(), `${locale}.toml`);
}

/**
 * Get path to base config for current implementation
 */
export function getBaseConfigPath(): string {
  return getPaths(requireImpl()).baseConfigPath;
}

/**
 * Get project root path
 */
export function getProjectRoot(): string {
  return _getProjectRoot();
}
