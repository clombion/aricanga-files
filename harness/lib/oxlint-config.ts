/**
 * The gate's oxlint configuration over a population (`oxlint.config.ts` builds it over the
 * repository's): every category at error, type-aware, with the project plugin and Solid's rules.
 * oxlint loads `oxlint.config.ts`; every check reads the value it loads (`oxlintConfig`,
 * `config-modules.ts`), and a planted run writes that value as its JSON configuration (`writeOxlintConfig`).
 */

import {
  BROWSER_TESTS,
  HARNESS_LIB,
  HARNESS_LINT_RULES,
  RUNNER_CONFIGS,
  RUNNER_TESTS,
  TEST_SUPPORT,
  VITE_CONFIGS,
  liveGlobs,
} from './test-globs.ts';
import type { GateOverride, GateOxlintConfig } from './oxlint-shape.ts';
import { HARNESS_CODE, ROOT_MODULE_FILES, unheldPatterns } from './oxlint-files.ts';
import type { Member, Population } from './scope.ts';
import type { MemberRule } from './oxlint-rules.ts';
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
  jsPlugins: ['eslint-plugin-solid', `./${HARNESS_LINT_RULES}plugin.ts`],
  options: {
    denyWarnings: true,
    reportUnusedDisableDirectives: 'error',
    respectEslintDisableDirectives: false,
    typeAware: true,
  },
  overrides: [
    {
      files: [`${HARNESS_LINT_RULES}plugin.ts`, ...VITE_CONFIGS, ...RUNNER_CONFIGS, ...ROOT_MODULE_FILES, `${HARNESS_LIB}design-tokens.ts`],
      rules: {
        'import/no-default-export': 'off',
      },
    },
    {
      files: [`${HARNESS_LIB}guards.ts`],
      rules: {
        'vitest/require-top-level-describe': 'off',
      },
    },
    {
      files: [`${HARNESS_LIB}checker.ts`],
      rules: {
        'eslint/no-bitwise': 'off',
      },
    },
  ],
  plugins: ['import', 'jsdoc', 'jsx-a11y', 'node', 'oxc', 'promise', 'typescript', 'unicorn', 'vitest'],
} satisfies OxlintConfig;

/** A member rule's setting: its level and the options that name members. */
type MemberSetting = NonNullable<OxlintConfig['rules']>[MemberRule];

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

/** A member's tool configs, which run on Node: its Vite and Playwright configs. */
const NODE_MODULES: readonly string[] = [...VITE_CONFIGS, ...RUNNER_CONFIGS];

/**
 * Why the harness's code reads no locale: `Intl`, bare or read from `globalThis` (`window` and `self`
 * are `unicorn/prefer-global-this`'s), `localeCompare` and every `toLocale*` method answer by the
 * process's locale and the runtime's ICU data. The message names the replacement.
 */
const LOCALE =
  "the harness compares and formats by code unit, never by the process's locale: compare with byCodeUnit (harness/lib/lists.ts) and format with String or toFixed";

/** The methods that compare or format by the process's locale. */
const LOCALE_METHODS: readonly string[] = [
  'localeCompare',
  'toLocaleDateString',
  'toLocaleLowerCase',
  'toLocaleString',
  'toLocaleTimeString',
  'toLocaleUpperCase',
];

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
 * The modules that run on Node: the harness's code (its directory and the root modules), test
 * support, the runners' tests, a test-infrastructure member's browser tests and the tool configs.
 *
 * @param {Population} held - The population.
 * @returns {string[]} Their globs.
 */
function nodeModules(held: Population): string[] {
  return [
    ...HARNESS_CODE,
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
 * @returns {Readonly<Record<MemberRule, MemberSetting>>} The rule settings, one for each member rule.
 */
function memberRules(held: Population): Readonly<Record<MemberRule, MemberSetting>> {
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

/** The overrides the configuration names, each by what it holds: oxlint's overrides carry no name of their own (it refuses the key), so this is their one identity. */
type OverrideName = 'harness-locale' | 'node' | 'reducer-purity';

/**
 * The named overrides over a population, in the order oxlint applies them: a system's reducer purity
 * (where a system has a reducer surface), the modules that run on Node, the harness code's locale ban.
 *
 * @param {Population} held - The population.
 * @returns {ReadonlyMap<OverrideName, GateOverride>} The overrides, by name.
 */
function namedOverrides(held: Population): ReadonlyMap<OverrideName, GateOverride> {
  const reducers = roleGlobs(held, REDUCER);
  const purity: readonly (readonly [OverrideName, GateOverride])[] = isEmpty(reducers)
    ? []
    : [
        [
          'reducer-purity',
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
        ],
      ];
  return new Map([
    ...purity,
    ['node', { env: { node: true }, files: nodeModules(held), rules: { 'import/no-nodejs-modules': 'off' } }],
    [
      'harness-locale',
      {
        files: [...HARNESS_CODE],
        rules: {
          'no-restricted-globals': ['error', { message: LOCALE, name: 'Intl' }],
          'no-restricted-properties': [
            'error',
            ...LOCALE_METHODS.map((property) => ({ message: LOCALE, property })),
            { message: LOCALE, object: 'globalThis', property: 'Intl' },
          ],
        },
      },
    ],
  ]);
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
    overrides: [...namedOverrides(held).values(), ...boundariesOf(held), ...SETTINGS.overrides],
    rules: { ...RULES, ...memberRules(held) },
  };
}

export { namedOverrides, oxlintConfigOf };
