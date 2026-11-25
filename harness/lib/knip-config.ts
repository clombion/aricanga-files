/**
 * The gate's knip configuration over a population (`knip.config.ts` builds it over the
 * repository's): every issue type at error, each workspace's project and entries. knip loads
 * `knip.config.ts`; every check reads the value it loads (`knipConfig`, `config-modules.ts`).
 */

import type { KnipConfiguration } from 'knip';
import type { Population } from './scope.ts';

/** The settings every population shares. */
const SETTINGS: KnipConfiguration = {
  ignoreDependencies: [
    '@ai-sdk/anthropic',
    '@ai-sdk/google',
    '@ai-sdk/openai',
    '@narratives/framework',
    '@narratives/test-utils',
    '@viz-js/viz',
    'ai',
    'jscpd',
    'remark-parse',
    'unified',
    'unist-util-visit',
    'xstate',
    'zod',
    '@solidjs/compiler',
  ],
  ignoreWorkspaces: ['packages/framework', 'packages/tests', 'packages/test-utils', 'experiences/aricanga'],
  rules: {
    binaries: 'error',
    catalog: 'error',
    catalogReferences: 'error',
    cycles: 'error',
    dependencies: 'error',
    devDependencies: 'error',
    duplicates: 'error',
    enumMembers: 'error',
    exports: 'error',
    files: 'error',
    namespaceMembers: 'error',
    nsExports: 'error',
    nsTypes: 'error',
    optionalPeerDependencies: 'error',
    types: 'error',
    unlisted: 'error',
    unresolved: 'error',
  },
  workspaces: {
    '.': {
      entry: ['harness/scripts/*.ts', 'harness/checks/*.test.ts'],
      playwright: false,
      project: ['harness/**/*.ts'],
    },
    'experiences/sandbox': {
      playwright: {
        config: ['playwright.sandbox.config.ts'],
      },
      project: ['src/**/*.{ts,tsx}!', 'test/**/*.ts'],
    },
    'packages/characterisation': {
      playwright: {
        config: ['playwright.characterisation.config.ts'],
      },
      project: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    },
    'packages/foundation': {
      project: ['src/**/*.ts!'],
    },
    'packages/systems/cards': {
      project: ['src/**/*.ts!'],
    },
    'packages/systems/chat': {
      project: ['src/**/*.ts!', 'test/**/*.ts'],
    },
  },
};

/**
 * The knip configuration over a population.
 *
 * @param {Population} _held - The population.
 * @returns {KnipConfiguration} The configuration.
 */
function knipConfigOf(_held: Population): KnipConfiguration {
  return SETTINGS;
}

export { knipConfigOf };
