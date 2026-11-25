/**
 * Every project lint rule fires on its must-fire fixtures and passes its must-stay-clean ones under the repository's oxlint.
 *
 * The plugin (`harness/lint-rules/plugin.ts`) holds exactly the declared rules; every rule has a
 * fixture folder with at least one must-fire and one must-stay-clean case, and every folder names a
 * rule. One oxlint run over a planted project, configured by the repository's oxlint configuration, must report
 * each rule on its must-fire fixtures and nothing at all on the must-stay-clean ones. The config turns
 * on exactly the plugin's rules, as errors, and the README's table lists exactly them with their
 * descriptions.
 */

import { FixtureError, codesAt, fixtureFolders, fixtures, lintFixtures, parseFixture } from '#lib/lint-rules.ts';
import { PLUGIN_NAME, RULES } from '#lint-rules/plugin.ts';
import { describe, expect, test } from 'vitest';
import { Accepted } from '#lib/exemptions.ts';
import type { Fixture } from '#lib/lint-rules.ts';
import { object } from '#lib/config.ts';
import { oxlintConfig } from '#lib/config-modules.ts';
import { textOf } from '#lib/source-files.ts';

const HARNESS_ID = 'project-lint-rules';

const DECLARED = new Accepted([
  'autofocus',
  'controlled',
  'env',
  'flags',
  'json',
  'labels',
  'legacy',
  'mechanics',
  'mirrors',
  'own-keys',
  'statics',
  'store-owner',
  'style-prop',
  'sync-parts',
  'total-reads',
  'view-imports',
  'vm-prop',
]);
const PLUGIN_PATH = './harness/lint-rules/plugin.ts';
const README = 'harness/lint-rules/README.md';
const TABLE_ROW = /^\| `aricanga\/(?<rule>[a-z-]+)` \| (?<description>.+) \|$/gmu;

/** What the README reads of a rule: its description. */
type Described = Readonly<{ meta: Readonly<{ docs: Readonly<{ description: string }> }> }>;

const ruleNames = (): readonly string[] => Object.keys(RULES).toSorted();
const descriptions = (): ReadonlyMap<string, string> =>
  new Map(Object.entries(RULES).map(([name, rule]: readonly [string, Described]) => [name, rule.meta.docs.description]));

/**
 * What breaks "every rule has a fixture folder with both kinds, and every folder a rule".
 *
 * @param {readonly string[]} rules - The rules.
 * @param {readonly string[]} folders - The folders.
 * @param {readonly Fixture[]} found - The fixtures found on disk.
 * @returns {readonly string[]} What breaks "every rule has a fixture folder with both kinds, and every folder a rule".
 */
function fixtureProblems(rules: readonly string[], folders: readonly string[], found: readonly Fixture[]): readonly string[] {
  const problems = folders.filter((folder) => !rules.includes(folder)).map((folder) => `fixtures/${folder}: no such rule`);
  for (const rule of rules) {
    for (const kind of ['fire', 'clean'] as const) {
      if (!found.some((fixture) => fixture.rule === rule && fixture.kind === kind)) {
        problems.push(`${rule}: no ${kind} fixture`);
      }
    }
  }
  return problems;
}

/**
 * A rule setting's level: the setting itself, or the first entry of `[level, options]`.
 *
 * @param {unknown} setting - A rule's setting in the config.
 * @returns {unknown} A rule setting's level: the setting itself, or the first entry of `[level, options]`.
 */
function level(setting: unknown): unknown {
  if (!Array.isArray(setting)) {
    return setting;
  }
  const entries: readonly unknown[] = setting;
  const [first] = entries;
  return first;
}

/**
 * What is wrong with one configured plugin rule: no such rule, or a level other than error.
 *
 * @param {string} name - The rule's configured name.
 * @param {unknown} setting - Its setting.
 * @param {readonly string[]} rules - The plugin's rules.
 * @returns {readonly string[]} The rule's problem, if any.
 */
function settingProblems(name: string, setting: unknown, rules: readonly string[]): readonly string[] {
  if (!rules.includes(name.slice(`${PLUGIN_NAME}/`.length))) {
    return [`${name}: not a rule of the plugin`];
  }
  const severity = level(setting);
  return severity === 'error' ? [] : [`${name}: is ${JSON.stringify(severity)}, not "error"`];
}

/**
 * What breaks "the config turns on exactly the plugin's rules, as errors".
 *
 * @param {unknown} config - The config.
 * @param {readonly string[]} rules - The rules.
 * @returns {readonly string[]} What breaks "the config turns on exactly the plugin's rules, as errors".
 */
function configProblems(config: unknown, rules: readonly string[]): readonly string[] {
  const fields = object(config, 'oxlint.config.ts');
  const plugins: readonly unknown[] = Array.isArray(fields['jsPlugins']) ? fields['jsPlugins'] : [];
  const loaded = plugins.includes(PLUGIN_PATH) ? [] : [`jsPlugins does not load ${PLUGIN_PATH}`];
  const prefix = `${PLUGIN_NAME}/`;
  const settings = object(fields['rules'] ?? {}, 'rules');
  const configured = Object.keys(settings).filter((name) => name.startsWith(prefix));
  const wrong = configured.flatMap((name) => settingProblems(name, settings[name], rules));
  const on = new Set(configured.map((name) => name.slice(prefix.length)));
  return [...loaded, ...wrong, ...rules.filter((rule) => !on.has(rule)).map((rule) => `${prefix}${rule}: not turned on`)];
}

/**
 * What breaks "the README's table lists exactly the rules, with their descriptions".
 *
 * @param {string} readme - The readme.
 * @param {ReadonlyMap<string, string>} described - Each rule's description in the docs table, by rule.
 * @returns {readonly string[]} What breaks "the README's table lists exactly the rules, with their descriptions".
 */
function readmeProblems(readme: string, described: ReadonlyMap<string, string>): readonly string[] {
  const rows = new Map<string, string>();
  for (const row of readme.matchAll(TABLE_ROW)) {
    rows.set(row.groups?.['rule'] ?? '', row.groups?.['description'] ?? '');
  }
  const problems = [...rows.keys()].filter((rule) => !described.has(rule)).map((rule) => `README lists ${rule}: no such rule`);
  for (const [rule, description] of described) {
    const row = rows.get(rule);
    if (row === undefined) {
      problems.push(`README does not list ${rule}`);
    } else if (row !== description) {
      problems.push(`README describes ${rule} as "${row}", the rule as "${description}"`);
    }
  }
  return problems;
}

/**
 * Whether a fixture's lint holds: a must-fire fixture reports its rule, a must-stay-clean one nothing.
 *
 * @param {Fixture} fixture - The fixture.
 * @param {readonly string[]} codes - The codes its lint reported.
 * @returns {boolean} Whether it holds.
 */
function holds(fixture: Fixture, codes: readonly string[]): boolean {
  if (fixture.kind === 'fire') {
    return codes.includes(`${PLUGIN_NAME}(${fixture.rule})`);
  }
  const [first] = codes;
  return first === undefined;
}

/**
 * The fixtures whose lint does not hold, with the codes reported.
 *
 * @returns {Promise<readonly { readonly codes: readonly string[]; readonly file: string }[]>} Each fixture that does not hold.
 */
async function unheldFixtures(): Promise<readonly { readonly codes: readonly string[]; readonly file: string }[]> {
  const planted = await fixtures();
  const found = await lintFixtures(planted);
  return planted.flatMap((fixture) => {
    const codes = codesAt(found, fixture.path);
    return holds(fixture, codes) ? [] : [{ codes, file: fixture.file }];
  });
}

describe('the repository', () => {
  test('the plugin holds exactly the declared rules', () => {
    expect.hasAssertions();
    expect(ruleNames()).toStrictEqual([...DECLARED]);
  });

  test('every rule has must-fire and must-stay-clean fixtures, and every fixture folder a rule', async () => {
    expect.hasAssertions();
    const [folders, planted] = await Promise.all([fixtureFolders(), fixtures()]);
    const problems = fixtureProblems(ruleNames(), folders, planted);
    expect(problems).toStrictEqual([]);
  });

  test('the config turns on exactly the plugin rules, and the README lists them', async () => {
    expect.hasAssertions();
    const [config, readme] = await Promise.all([oxlintConfig(), textOf(README)]);
    expect(configProblems(config, ruleNames())).toStrictEqual([]);
    expect(readmeProblems(readme, descriptions())).toStrictEqual([]);
  });

  test('each must-fire fixture fails on its rule and each must-stay-clean fixture passes', async () => {
    expect.hasAssertions();
    await expect(unheldFixtures()).resolves.toStrictEqual([]);
  });
});

describe('the fixture reader', () => {
  test('reads a fixture and the path it is planted at', () => {
    expect.hasAssertions();
    const fixture = parseFixture('harness/lint-rules/fixtures/env/fire-import.fixture', '// path: a/b.ts\nexport {};\n');
    expect(fixture).toStrictEqual({
      file: 'harness/lint-rules/fixtures/env/fire-import.fixture',
      kind: 'fire',
      path: 'a/b.ts',
      rule: 'env',
      source: 'export {};\n',
    });
  });

  test.each([
    ['harness/lint-rules/fixtures/env/broken.fixture', '// path: a.ts\n'],
    ['harness/lint-rules/fixtures/env/fire.ts', '// path: a.ts\n'],
    ['harness/lint-rules/fixtures/env/fire.fixture', 'export {};\n'],
  ])('refuses the malformed fixture %s', (file, text) => {
    expect.hasAssertions();
    expect(() => parseFixture(file, text)).toThrow(FixtureError);
  });
});

function plantedFixture(rule: string, kind: 'fire' | 'clean'): Fixture {
  return { file: `harness/lint-rules/fixtures/${rule}/${kind}.fixture`, kind, path: `${rule}-${kind}.ts`, rule, source: '' };
}

describe('the check', () => {
  test('sees a rule without a fixture of each kind, and a folder without a rule', () => {
    expect.hasAssertions();
    expect(
      fixtureProblems(['env', 'json'], ['env', 'json', 'gone'], [plantedFixture('env', 'fire'), plantedFixture('json', 'clean')]),
    ).toStrictEqual(['fixtures/gone: no such rule', 'env: no clean fixture', 'json: no fire fixture']);
    expect(fixtureProblems(['env'], ['env'], [plantedFixture('env', 'fire'), plantedFixture('env', 'clean')])).toStrictEqual([]);
  });

  test('sees a rule the config leaves off, one it adds, one it only warns on, and a missing plugin', () => {
    expect.hasAssertions();
    const config = {
      jsPlugins: ['eslint-plugin-solid'],
      rules: { 'aricanga/env': 'warn', 'aricanga/gone': 'error', 'solid/no-destructure': 'error' },
    };
    expect(configProblems(config, ['env', 'json'])).toStrictEqual([
      'jsPlugins does not load ./harness/lint-rules/plugin.ts',
      'aricanga/env: is "warn", not "error"',
      'aricanga/gone: not a rule of the plugin',
      'aricanga/json: not turned on',
    ]);
    const near = { jsPlugins: [PLUGIN_PATH], rules: { 'aricanga/env': ['error', { owners: [] }], 'aricanga/json': 'error' } };
    expect(configProblems(near, ['env', 'json'])).toStrictEqual([]);
  });

  test('sees a README row missing, extra or out of date', () => {
    expect.hasAssertions();
    const described = new Map([
      ['env', 'one'],
      ['json', 'two'],
    ]);
    const readme = '| `aricanga/env` | stale |\n| `aricanga/gone` | x |\n';
    expect(readmeProblems(readme, described)).toStrictEqual([
      'README lists gone: no such rule',
      'README describes env as "stale", the rule as "one"',
      'README does not list json',
    ]);
    expect(readmeProblems('| `aricanga/env` | one |\n| `aricanga/json` | two |\n', described)).toStrictEqual([]);
  });
});

export { HARNESS_ID, configProblems, fixtureProblems, readmeProblems };
