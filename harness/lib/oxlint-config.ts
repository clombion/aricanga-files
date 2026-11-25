/**
 * The gate's oxlint configuration over a population (`oxlint.config.ts` builds it over the
 * repository's): every category at error, type-aware, with the project plugin and Solid's rules.
 * oxlint loads `oxlint.config.ts`; every check reads the value it loads (`oxlintConfig`,
 * `config-modules.ts`), and a planted run writes that value as its JSON configuration (`writeOxlintConfig`).
 */

import type { OxlintConfig } from 'oxlint';
import type { Population } from './scope.ts';
import { ROOT_MODULES } from './config-modules.ts';
import { RULES } from './oxlint-rules.ts';

/** The settings beside the rule levels. */
const SETTINGS: OxlintConfig = {
  categories: {
    correctness: 'error',
    nursery: 'error',
    pedantic: 'error',
    perf: 'error',
    restriction: 'error',
    style: 'error',
    suspicious: 'error',
  },
  env: {
    browser: true,
    builtin: true,
    es2024: true,
  },
  ignorePatterns: [
    'packages/framework/**',
    'packages/tests/**',
    'packages/test-utils/**',
    'experiences/aricanga/**',
    'utils/**',
    'templates/**',
    'docs/**',
    '**/dist/**',
    '**/vendor/**',
    'vite.config.js',
    'playwright.config.ts',
    'vitest.config.ts',
  ],
  jsPlugins: ['eslint-plugin-solid', './harness/lint-rules/plugin.ts'],
  options: {
    denyWarnings: true,
    reportUnusedDisableDirectives: 'error',
    respectEslintDisableDirectives: false,
    typeAware: true,
  },
  overrides: [
    {
      files: ['packages/foundation/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@narratives/*',
                  '!@narratives/foundation',
                  '!@narratives/foundation/*',
                  'sandbox',
                  '**/systems/**',
                  '**/experiences/**',
                ],
                message: 'foundation imports nothing from the rebuild (ADR-0005)',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['packages/systems/chat/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@narratives/*',
                  '!@narratives/foundation',
                  '!@narratives/foundation/*',
                  '!@narratives/system-chat',
                  '!@narratives/system-chat/*',
                  '**/experiences/**',
                  '../../*/src/**',
                  '!../../chat/src/**',
                  '../../../*/src/**',
                  '!../../../chat/src/**',
                ],
                message: 'a system imports only foundation: no other system, no experience, no POC (ADR-0005)',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['packages/systems/cards/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@narratives/*',
                  '!@narratives/foundation',
                  '!@narratives/foundation/*',
                  '!@narratives/system-cards',
                  '!@narratives/system-cards/*',
                  '**/experiences/**',
                  '../../*/src/**',
                  '!../../cards/src/**',
                  '../../../*/src/**',
                  '!../../../cards/src/**',
                ],
                message: 'a system imports only foundation: no other system, no experience, no POC (ADR-0005)',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['experiences/sandbox/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@narratives/framework',
                  '@narratives/framework/*',
                  '@narratives/test-utils',
                  '@narratives/test-utils/*',
                  '**/aricanga/**',
                  '../../experiences/**',
                ],
                message: 'an experience imports foundation and systems only: no other experience, no POC (ADR-0005)',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['packages/characterisation/**', 'harness/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@narratives/framework', '@narratives/framework/*', '@narratives/test-utils', '@narratives/test-utils/*'],
                message: 'the rebuild never imports the POC reference (ADR-0006, Scope)',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['packages/systems/*/src/system.ts', 'packages/systems/*/src/model/**'],
      rules: {
        'no-restricted-globals': [
          'error',
          {
            message: 'no Date in a reducer: time is simulation-derived (ADR-0007)',
            name: 'Date',
          },
        ],
        'no-restricted-properties': [
          'error',
          {
            message: 'no Math.random in a reducer: ids come from ctx.nextId (ADR-0007)',
            object: 'Math',
            property: 'random',
          },
        ],
      },
    },
    {
      env: {
        node: true,
      },
      files: [
        'harness/**',
        '**/test/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        'packages/characterisation/tests/**',
        '**/vite.config.ts',
        '**/vitest.config.ts',
        '*.config.ts',
        'vitest.gate.config.ts',
      ],
      rules: {
        'import/no-nodejs-modules': 'off',
      },
    },
    {
      files: [
        'harness/lint-rules/plugin.ts',
        '**/vite.config.ts',
        '**/playwright.*.config.ts',
        ...ROOT_MODULES,
        'harness/lib/design-tokens.ts',
      ],
      rules: {
        'import/no-default-export': 'off',
      },
    },
    {
      files: ['harness/lib/guards.ts'],
      rules: {
        'vitest/require-top-level-describe': 'off',
      },
    },
    {
      files: ['harness/lib/checker.ts'],
      rules: {
        'eslint/no-bitwise': 'off',
      },
    },
  ],
  plugins: ['import', 'jsdoc', 'jsx-a11y', 'node', 'oxc', 'promise', 'typescript', 'unicorn', 'vitest'],
};

/**
 * The oxlint configuration over a population.
 *
 * @param {Population} _held - The population.
 * @returns {OxlintConfig} The configuration.
 */
function oxlintConfigOf(_held: Population): OxlintConfig {
  return { ...SETTINGS, rules: RULES };
}

export { oxlintConfigOf };
