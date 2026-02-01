/**
 * Centralized path definitions for TypeScript tests
 * Mirrors utils/lib/locale-config.js getPaths() for consistency
 *
 * INTENT: Provide consistent paths across test utilities.
 * ASSUMPTION: Implementation structure is experiences/{impl}/ with
 *   standard subdirectories (data/, src/, ink/, tests/).
 * BREAKS if: Project structure changes or experiences/ directory moves.
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = process.cwd();

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

export interface Paths {
  projectRoot: string;
  implDir: string;
  dataDir: string;
  localesDir: string;
  baseConfigPath: string;
  srcDir: string;
  generatedDir: string;
  configOutput: string;
  cssDir: string;
  themeVarsOutput: string;
  inkDir: string;
  distDir: string;
  localesOutputDir: string;
  testsDir: string;
  fixturesDir: string;
  expectationsOutput: string;
}

/**
 * Get all standard paths for an implementation
 * Single source of truth for tests
 */
export function getPaths(impl: string = getImpl()): Paths {
  const implDir = path.join(PROJECT_ROOT, 'experiences', impl);
  const dataDir = path.join(implDir, 'data');
  const srcDir = path.join(implDir, 'src');

  return {
    // Root paths
    projectRoot: PROJECT_ROOT,
    implDir,

    // Data paths
    dataDir,
    localesDir: path.join(dataDir, 'locales'),
    baseConfigPath: path.join(dataDir, 'base-config.toml'),

    // Source paths
    srcDir,
    generatedDir: path.join(srcDir, 'generated'),
    configOutput: path.join(srcDir, 'generated/config.js'),

    // CSS paths
    cssDir: path.join(implDir, 'css'),
    themeVarsOutput: path.join(implDir, 'css/generated/theme-vars.css'),

    // Ink paths
    inkDir: path.join(implDir, 'ink'),

    // Dist paths
    distDir: path.join(srcDir, 'dist'),
    localesOutputDir: path.join(srcDir, 'dist/locales'),

    // Test paths
    testsDir: path.join(implDir, 'tests'),
    fixturesDir: path.join(implDir, 'tests/fixtures'),
    expectationsOutput: path.join(implDir, 'tests/fixtures/generated-expectations.ts'),
  };
}

/**
 * Get project root path
 */
export function getProjectRoot(): string {
  return PROJECT_ROOT;
}
