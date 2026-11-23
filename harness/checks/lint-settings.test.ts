/**
 * oxlint, under this project's settings, fails each planted violation of a rule the harness rests on.
 *
 * One type-aware run of the locked oxlint over a planted project holding a copy of `.oxlintrc.json`
 * and `tsconfig.base.json`. Each plant is a file that must fail with exactly its rule; a described
 * `@ts-expect-error` and the clean plant must pass. The options are proven by removal: a lone
 * warning fails the run under `denyWarnings` and passes without it; an unused disable directive
 * fails under `reportUnusedDisableDirectives` and passes without it; an `eslint-disable` comment
 * silences nothing under `respectEslintDisableDirectives: false` and silences its rule with it.
 * `eslint-plugin-solid` is loaded as a JS plugin, a destructured component fails, and its rules in
 * the config are exactly its `v2-strict` config. Every category is on at error, and every rule the
 * config turns off, at the top level or in an override, is declared with its reason: the enabled
 * rule it contradicts, or the code it does not apply to.
 */

import { Accepted, Exemptions } from '#lib/exemptions.ts';
import { ESLINT_DIRECTIVE_TEXT, UNUSED_DIRECTIVE_TEXT, WARNING_PLANT, WARNING_TEXT } from './lint-settings.plants.ts';
import { EXIT_CLEAN, EXIT_FINDINGS } from './exit-status.ts';
import { config, lint, plantedCodes, repoConfig } from './lint-settings.run.ts';
import { describe, expect, test } from 'vitest';
import { object, parsed } from '#lib/config.ts';
import type { Options } from './lint-settings.run.ts';
import { finished } from '#lib/tools.ts';
import { fromRoot } from '#lib/paths.ts';

const HARNESS_ID = 'lint-settings';

/** The oxlint rule categories: the config turns every one on at error. */
const CATEGORIES = new Accepted(['correctness', 'suspicious', 'perf', 'pedantic', 'style', 'restriction', 'nursery']);

/**
 * The rules the config turns off, each with its reason: the enabled rule it contradicts, the
 * mirrored config that turns it off, or the code it does not apply to. A rule turned off and not
 * listed fails, and so does an entry the config does not turn off.
 */
const TURNED_OFF = Exemptions.grouped({
  'a Vitest setup file registers its hooks at top level, outside any describe; the override holds only harness/lib/guards.ts': [
    'vitest/require-top-level-describe',
  ],
  'asks for the truthy and falsy matchers vitest/prefer-strict-boolean-matchers refuses; toBe(true) and toBe(false) stay': [
    'vitest/prefer-to-be-falsy',
    'vitest/prefer-to-be-truthy',
  ],
  'bans Node builtins from browser code; the override turns it off only for the code that runs on Node': ['import/no-nodejs-modules'],
  'contradicts eslint/prefer-object-spread': ['oxc/no-rest-spread-properties'],
  'contradicts import/no-default-export, which holds every module to named exports': [
    'import/no-named-export',
    'import/prefer-default-export',
  ],
  'contradicts promise/prefer-await-to-then': ['oxc/no-async-await'],
  'contradicts typescript/prefer-optional-chain': ['oxc/no-optional-chaining'],
  'contradicts unicorn/no-null: absence is written undefined, the form exactOptionalPropertyTypes types': ['eslint/no-undefined'],
  'contradicts unicorn/prefer-ternary': ['eslint/no-ternary'],
  'contradicts unicorn/prefer-top-level-await; the browser entries are ES modules': ['node/no-top-level-await'],
  'contradicts vitest/prefer-importing-vitest-globals': ['vitest/no-importing-vitest-globals'],
  'contradicts vitest/require-hook': ['vitest/no-hooks'],
  "has no setting for Solid's `for`; label association is the project rule aricanga/labels (ADR-0008)": [
    'jsx-a11y/label-has-associated-control',
  ],
  'off in eslint-plugin-solid v2-strict, which the config mirrors exactly (the v2-strict test below)': [
    'solid/no-react-deps',
    'solid/no-array-handlers',
    'solid/prefer-show',
    'solid/no-proxy-apis',
    'solid/prefer-classlist',
  ],
  'oxlint, stylelint, Vite, Playwright and Vitest load the plugin and config modules through their default export; the override holds only those':
    ['import/no-default-export'],
  "restates the gate config's one testTimeout, which the vitest-settings check holds": ['vitest/require-test-timeout'],
  "the TypeScript API exposes a symbol's kind only as bit flags; the override holds only harness/lib/checker.ts": ['eslint/no-bitwise'],
});

const SEVERITY = /^(?:off|0)$/u;
/** The numeric severities a config may write. */
const NUMERIC_OFF = 0;
const NUMERIC_ERROR = 2;

/**
 * The severity of one rule setting: the setting, or the first element of an array setting.
 *
 * @param {unknown} setting - A rule's setting.
 * @returns {unknown} Its severity.
 */
function severity(setting: unknown): unknown {
  if (!Array.isArray(setting)) {
    return setting;
  }
  const levels: readonly unknown[] = setting;
  const [level] = levels;
  return level;
}

/**
 * The rules a config turns on, among those named with `prefix`.
 *
 * @param {Options} rules - A config's rule settings.
 * @param {string} prefix - The start of the rule names to read.
 * @returns {readonly string[]} The enabled rules, sorted.
 */
function enabled(rules: Options, prefix: string): readonly string[] {
  return Object.keys(rules)
    .filter((rule) => rule.startsWith(prefix) && !SEVERITY.test(String(severity(rules[rule]))))
    .toSorted();
}

/**
 * The rules a config turns off, at the top level and in every override.
 *
 * @param {unknown} configText - The parsed config.
 * @returns {readonly string[]} The rules turned off, sorted.
 */
function turnedOff(configText: unknown): readonly string[] {
  const repo = object(configText, '.oxlintrc.json');
  const overrides: readonly unknown[] = Array.isArray(repo['overrides']) ? repo['overrides'] : [];
  const ruleSets = [repo['rules'] ?? {}, ...overrides.map((entry) => object(entry, 'override')['rules'] ?? {})];
  const off = ruleSets.flatMap((rules) => {
    const all = object(rules, 'rules');
    const on = new Set(enabled(all, ''));
    return Object.keys(all).filter((rule) => !on.has(rule));
  });
  return [...new Set(off)].toSorted();
}

/**
 * The categories a config does not turn on at error.
 *
 * @param {unknown} configText - The parsed config.
 * @returns {readonly string[]} One problem per category.
 */
function categoryProblems(configText: unknown): readonly string[] {
  const categories = object(object(configText, '.oxlintrc.json')['categories'] ?? {}, 'categories');
  return [...CATEGORIES].filter((category) => categories[category] !== 'error').map((category) => `${category} is not at error`);
}

/**
 * The `v2-strict` rules of eslint-plugin-solid, read from the locked plugin.
 *
 * @returns {Promise<Options>} The rule settings.
 */
async function v2Strict(): Promise<Options> {
  const done = await finished(
    [
      process.execPath,
      '--input-type=module',
      '-e',
      "const m = await import('eslint-plugin-solid/configs/v2-strict'); process.stdout.write(JSON.stringify(m.default.rules));",
    ],
    { cwd: fromRoot() },
  );
  return object(parsed(done.stdout, 'v2-strict rules'), 'v2-strict rules');
}

/**
 * The rule settings of the repository config.
 *
 * @returns {Promise<Options>} The settings, by rule.
 */
async function repoRules(): Promise<Options> {
  const repo = await repoConfig();
  return object(repo['rules'] ?? {}, 'rules');
}

/**
 * The JS plugins the repository config loads.
 *
 * @returns {Promise<readonly unknown[]>} The listed plugins.
 */
async function jsPlugins(): Promise<readonly unknown[]> {
  const repo = await repoConfig();
  const plugins = repo['jsPlugins'];
  const listed: readonly unknown[] = Array.isArray(plugins) ? plugins : [];
  return listed;
}

describe('the repository config', () => {
  test('fails each planted violation with exactly its rule, and passes the near misses', async () => {
    expect.hasAssertions();
    const [reported, expected] = await plantedCodes();
    expect(reported).toStrictEqual(expected);
  });

  test('turns on exactly the rules of eslint-plugin-solid v2-strict, loaded as a JS plugin', async () => {
    expect.hasAssertions();
    const [plugins, rules, strict] = await Promise.all([jsPlugins(), repoRules(), v2Strict()]);
    expect(plugins).toContain('eslint-plugin-solid');
    expect(enabled(rules, 'solid/')).toStrictEqual(enabled(strict, 'solid/'));
  });
});

describe('the strictness of the config', () => {
  test('turns every category on at error', async () => {
    expect.hasAssertions();
    const repo = await repoConfig();
    expect(categoryProblems(repo)).toStrictEqual([]);
  });

  test('declares every rule it turns off with its reason', async () => {
    expect.hasAssertions();
    const repo = await repoConfig();
    const off = turnedOff(repo);
    expect(TURNED_OFF.unexempted(off)).toStrictEqual([]);
  });

  test('sees a category left out or below error, and a rule turned off at the top or in an override', () => {
    expect.hasAssertions();
    expect(categoryProblems({ categories: { correctness: 'error', style: 'warn' } })).toStrictEqual([
      'nursery is not at error',
      'pedantic is not at error',
      'perf is not at error',
      'restriction is not at error',
      'style is not at error',
      'suspicious is not at error',
    ]);
    const planted = { overrides: [{ files: ['x'], rules: { off: ['off'], warned: 'warn' } }], rules: { erred: 'error', gone: 'off' } };
    expect(turnedOff(planted)).toStrictEqual(['gone', 'off']);
  });
});

describe('each option, by removal', () => {
  test('denyWarnings: a lone warning fails the run, and passes without it', async () => {
    expect.hasAssertions();
    const warn = { 'eslint/no-debugger': 'warn' };
    const denied = await lint({ [WARNING_PLANT]: WARNING_TEXT }, await config({}, warn));
    expect(denied.status).toBe(EXIT_FINDINGS);
    const allowed = await lint({ [WARNING_PLANT]: WARNING_TEXT }, await config({ denyWarnings: false }, warn));
    expect(allowed.status).toBe(EXIT_CLEAN);
  });

  test('reportUnusedDisableDirectives: an unused directive passes without it', async () => {
    expect.hasAssertions();
    const run = await lint({ 'src/unused-directive.ts': UNUSED_DIRECTIVE_TEXT }, await config({ reportUnusedDisableDirectives: 'off' }));
    expect(run.status).toBe(EXIT_CLEAN);
  });

  test('respectEslintDisableDirectives: false, an eslint-disable comment silences its rule once respected', async () => {
    expect.hasAssertions();
    const run = await lint({ 'src/eslint-directive.ts': ESLINT_DIRECTIVE_TEXT }, await config({ respectEslintDisableDirectives: true }));
    expect(run.status).toBe(EXIT_CLEAN);
  });
});

describe('the rule comparison', () => {
  test('sees a missing, an extra and a disabled rule, and reads severities', () => {
    expect.hasAssertions();
    const rules = { other: 'error', 'solid/a': 'error', 'solid/b': NUMERIC_ERROR, 'solid/c': 'off', 'solid/d': ['warn', {}] };
    expect(enabled(rules, 'solid/')).toStrictEqual(['solid/a', 'solid/b', 'solid/d']);
    expect(enabled({ 'solid/a': NUMERIC_OFF }, 'solid/')).toStrictEqual([]);
  });
});

export { HARNESS_ID, categoryProblems, enabled, turnedOff };
