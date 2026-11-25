/**
 * The gate's oxlint configuration over a population (`oxlint.config.ts` builds it over the
 * repository's): every category at error, type-aware, with the project plugin and Solid's rules.
 * oxlint loads `oxlint.config.ts`; every check reads the value it loads (`oxlintConfig`,
 * `config-modules.ts`), and a planted run writes that value as its JSON configuration (`writeOxlintConfig`).
 */

import { BROWSER_TESTS, RUNNER_TESTS, TEST_SUPPORT, liveGlobs } from './test-globs.ts';
import type { OxlintConfig, OxlintOverride } from 'oxlint';
import { ROOT_MODULE_FILES, unheldPatterns } from './oxlint-files.ts';
import type { Role, Tier } from './roles.ts';
import { HARNESS_ROOT } from './scope.ts';
import type { Population } from './scope.ts';
import { RULES } from './oxlint-rules.ts';
import { Vocabulary } from './exemptions.ts';
import { boundariesOf } from './import-boundaries.ts';
import { isEmpty } from './lists.ts';
import { tierOf } from './roles.ts';

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

/** A system's reducer surface, under its directory (ADR-0007). */
const REDUCER: readonly string[] = ['src/system.ts', SYSTEM_MODEL];

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
 * The globs of a tier's members' whole directories.
 *
 * @param {Population} held - The population.
 * @param {Tier} tier - The tier.
 * @returns {string[]} One `<dir>**` per member of the tier.
 */
function tierGlobs(held: Population, tier: Tier): string[] {
  return held.members.filter((member) => tierOf(member.role) === tier).map((member) => `${member.dir}**`);
}

/**
 * The globs of each member of a role under its directory, each only where the listing gives it a file.
 *
 * @param {Population} held - The population.
 * @param {Role} role - The role.
 * @param {readonly string[]} tails - The globs under each member's directory.
 * @returns {string[]} The globs.
 */
function roleGlobs(held: Population, role: Role, tails: readonly string[]): string[] {
  const members = held.members.filter((member) => member.role === role);
  return members.flatMap((member) => tails.flatMap((tail) => liveGlobs(held, [member], tail)));
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
    `**/${TEST_SUPPORT}**`,
    ...RUNNER_TESTS,
    ...roleGlobs(held, 'test-infrastructure', [`${BROWSER_TESTS}**`]),
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
  const testInfrastructure = tierGlobs(held, 'test-infrastructure');
  const ignored: ['error', { ignore: string[] }] = ['error', { ignore: testInfrastructure }];
  const mechanics = held.members.flatMap((member) => MECHANICS.of(member.role).flatMap((tail) => liveGlobs(held, [member], tail)));
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
 * @returns {OxlintOverride[]} The overrides.
 */
function memberOverrides(held: Population): OxlintOverride[] {
  const reducers = roleGlobs(held, 'system', REDUCER);
  const purity: OxlintOverride[] = isEmpty(reducers)
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
 * @returns {OxlintConfig} The configuration.
 */
function oxlintConfigOf(held: Population): OxlintConfig {
  return {
    ...SETTINGS,
    ignorePatterns: [...unheldPatterns(held), BUILD_OUTPUT],
    overrides: [...memberOverrides(held), ...SETTINGS.overrides],
    rules: { ...RULES, ...memberRules(held) },
  };
}

export { oxlintConfigOf };
