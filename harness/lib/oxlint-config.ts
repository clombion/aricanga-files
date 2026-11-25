/**
 * The gate's oxlint configuration over a population (`oxlint.config.ts` builds it over the
 * repository's): every category at error, type-aware, with the project plugin and Solid's rules.
 * oxlint loads `oxlint.config.ts`; every check reads the value it loads (`oxlintConfig`,
 * `config-modules.ts`), and a planted run writes that value as its JSON configuration (`writeOxlintConfig`).
 */

import { BROWSER_TESTS, RUNNER_TESTS, TEST_SUPPORT, liveGlobs } from './test-globs.ts';
import type { GateOverride, GateOxlintConfig } from './oxlint-shape.ts';
import type { Member, Population } from './scope.ts';
import { ROOT_MODULE_FILES, unheldPatterns } from './oxlint-files.ts';
import { HARNESS_ROOT } from './scope.ts';
import type { OxlintConfig } from 'oxlint';
import { RULES } from './oxlint-rules.ts';
import type { Role } from './roles.ts';
import { Vocabulary } from './exemptions.ts';
import { boundariesOf } from './import-boundaries.ts';
import { isEmpty } from './lists.ts';

/** The settings beside the rule levels. */
const SETTINGS = {
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
  jsPlugins: ['eslint-plugin-solid', './harness/lint-rules/plugin.ts'],
  options: {
    denyWarnings: true,
    reportUnusedDisableDirectives: 'error',
    respectEslintDisableDirectives: false,
    typeAware: true,
  },
  overrides: [
    {
      files: [
        'harness/lint-rules/plugin.ts',
        '**/vite.config.ts',
        '**/playwright.*.config.ts',
        ...ROOT_MODULE_FILES,
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
} satisfies OxlintConfig;

/** A system's model, under its directory: mechanics, and part of its reducer surface. */
const SYSTEM_MODEL = 'src/model/**';

/** The modules of each role the mechanics are, under the member's directory: total over the roles, so a new role declares its own (none outside the kernel). */
const MECHANICS: Vocabulary<Readonly<Record<Role, readonly string[]>>> = new Vocabulary<Readonly<Record<Role, readonly string[]>>>({
  experience: [],
  foundation: ['**'],
  system: [SYSTEM_MODEL],
  'test-infrastructure': [],
  view: [],
});

/** The modules of each role a reducer's surface is, under the member's directory (ADR-0007): total over the roles, so a new role declares its own (a system's alone). */
const REDUCER: Vocabulary<Readonly<Record<Role, readonly string[]>>> = new Vocabulary<Readonly<Record<Role, readonly string[]>>>({
  experience: [],
  foundation: [],
  system: ['src/system.ts', SYSTEM_MODEL],
  'test-infrastructure': [],
  view: [],
});

/** The tool configs, which run on Node: a member's Vite and Playwright configs, and the root modules. */
const NODE_MODULES: readonly string[] = ['**/vite.config.ts', '**/playwright.*.config.ts', ...ROOT_MODULE_FILES];

/**
 * Why a harness module reads no locale: `Intl`, bare or read from `globalThis` (`window` and `self`
 * are `unicorn/prefer-global-this`'s), and `localeCompare` answer by the process's locale and the
 * runtime's ICU data.
 */
const LOCALE = "a harness module compares and formats by code unit, never by the process's locale";

/** Untracked build output a checkout may hold. */
const BUILD_OUTPUT = '**/dist/**';

/**
 * The globs of the test infrastructure members' whole directories.
 *
 * @param {Population} held - The population.
 * @returns {string[]} One `<dir>**` per test infrastructure member.
 */
function testInfrastructureGlobs(held: Population): string[] {
  return held.testInfrastructure.map((member) => `${member.dir}**`);
}

/**
 * The globs of each selected member under its directory, each only where the listing gives it a file.
 *
 * @param {Population} held - The population.
 * @param {readonly Member[]} members - The members.
 * @param {readonly string[]} tails - The globs under each member's directory.
 * @returns {string[]} The globs.
 */
function memberGlobs(held: Population, members: readonly Member[], tails: readonly string[]): string[] {
  return members.flatMap((member) => tails.flatMap((tail) => liveGlobs(held, [member], tail)));
}

/**
 * The globs a table total over the roles gives each member, under its directory, each only where the
 * listing gives the member a file.
 *
 * @param {Population} held - The population.
 * @param {Vocabulary<Readonly<Record<Role, readonly string[]>>>} table - Each role's globs under a member's directory.
 * @returns {string[]} The globs.
 */
function roleGlobs(held: Population, table: Vocabulary<Readonly<Record<Role, readonly string[]>>>): string[] {
  return held.members.flatMap((member) => memberGlobs(held, [member], table.of(member.role)));
}

/**
 * The modules that run on Node: the harness, test support, the runners' tests, a test-infrastructure
 * member's browser tests and the tool configs.
 *
 * @param {Population} held - The population.
 * @returns {string[]} Their globs.
 */
function nodeModules(held: Population): string[] {
  return [
    `${HARNESS_ROOT}**`,
    ...memberGlobs(held, held.members, [`**/${TEST_SUPPORT}**`]),
    ...RUNNER_TESTS,
    ...memberGlobs(held, held.testInfrastructure, [`${BROWSER_TESTS}**`]),
    ...NODE_MODULES,
  ];
}

/**
 * The rules whose options name members: the Solid ban, and the rules the test infrastructure is outside of.
 *
 * @param {Population} held - The population.
 * @returns {NonNullable<OxlintConfig['rules']>} The rule settings.
 */
function memberRules(held: Population): NonNullable<OxlintConfig['rules']> {
  const testInfrastructure = testInfrastructureGlobs(held);
  const ignored: ['error', { ignore: string[] }] = ['error', { ignore: testInfrastructure }];
  const mechanics = roleGlobs(held, MECHANICS);
  return {
    'aricanga/flags': ignored,
    'aricanga/legacy': ignored,
    'aricanga/mechanics': isEmpty(mechanics) ? 'off' : ['error', { files: mechanics }],
    'aricanga/mirrors': ignored,
    'aricanga/store-owner': ['error', { owners: ['**/snapshot-adapter.ts', ...testInfrastructure] }],
    'aricanga/sync-parts': ignored,
    'aricanga/vm-prop': ignored,
  };
}

/**
 * The overrides that name members: a system's reducer purity, the modules that run on Node, the
 * harness's own restrictions, and the import boundaries (`import-boundaries.ts`).
 *
 * @param {Population} held - The population.
 * @returns {GateOverride[]} The overrides.
 */
function memberOverrides(held: Population): GateOverride[] {
  const reducers = roleGlobs(held, REDUCER);
  const purity: GateOverride[] = isEmpty(reducers)
    ? []
    : [
        {
          files: reducers,
          rules: {
            'no-restricted-globals': ['error', { message: 'no Date in a reducer: time is simulation-derived (ADR-0007)', name: 'Date' }],
            'no-restricted-properties': [
              'error',
              { message: 'no Math.random in a reducer: ids come from ctx.nextId (ADR-0007)', object: 'Math', property: 'random' },
            ],
          },
        },
      ];
  return [
    ...purity,
    { env: { node: true }, files: nodeModules(held), rules: { 'import/no-nodejs-modules': 'off' } },
    {
      files: [`${HARNESS_ROOT}**`],
      rules: {
        'no-restricted-globals': ['error', { message: LOCALE, name: 'Intl' }],
        'no-restricted-properties': [
          'error',
          { message: LOCALE, property: 'localeCompare' },
          { message: LOCALE, object: 'globalThis', property: 'Intl' },
        ],
      },
    },
    ...boundariesOf(held),
  ];
}

/**
 * The oxlint configuration over a population.
 *
 * @param {Population} held - The population.
 * @returns {GateOxlintConfig} The configuration.
 */
function oxlintConfigOf(held: Population): GateOxlintConfig {
  return {
    ...SETTINGS,
    ignorePatterns: [...unheldPatterns(held), BUILD_OUTPUT],
    overrides: [...memberOverrides(held), ...SETTINGS.overrides],
    rules: { ...RULES, ...memberRules(held) },
  };
}

export { oxlintConfigOf };
