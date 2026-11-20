/**
 * Every project lint rule fires on its must-fire fixtures and passes its must-stay-clean ones under the repository's oxlint.
 *
 * The plugin (`harness/lint-rules/plugin.ts`) holds exactly the declared rules; every rule has a
 * fixture folder with at least one must-fire and one must-stay-clean case, and every folder names a
 * rule. One oxlint run over a planted project, configured by a copy of `.oxlintrc.json`, must report
 * each rule on its must-fire fixtures and nothing at all on the must-stay-clean ones. The config turns
 * on exactly the plugin's rules, as errors, and the README's table lists exactly them with their
 * descriptions.
 */

import { FixtureError, codesAt, fixtureFolders, fixtures, lintFixtures, parseFixture } from '#lib/lint-rules.ts';
import { PLUGIN_NAME, RULES } from '#lint-rules/plugin.ts';
import { describe, expect, test } from 'vitest';
import { json, object } from '#lib/config.ts';
import { Accepted } from '#lib/exemptions.ts';
import type { Fixture } from '#lib/lint-rules.ts';
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
  'promises',
  'statics',
  'store-owner',
  'style-prop',
  'sync-parts',
  'view-imports',
  'vm-prop',
]);
const PLUGIN_PATH = './harness/lint-rules/plugin.ts';
const README = 'harness/lint-rules/README.md';
const TABLE_ROW = /^\| `aricanga\/([a-z-]+)` \| (.+) \|$/gmu;

const ruleNames = (): readonly string[] => Object.keys(RULES).toSorted();
const descriptions = (): ReadonlyMap<string, string> =>
  new Map(Object.entries(RULES).map(([name, rule]) => [name, rule.meta.docs.description]));

/** What breaks "every rule has a fixture folder with both kinds, and every folder a rule". */
function fixtureProblems(
  rules: readonly string[],
  folders: readonly string[],
  found: readonly Fixture[],
): readonly string[] {
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

/** A rule setting's level: the setting itself, or the first entry of `[level, options]`. */
function level(setting: unknown): unknown {
  if (!Array.isArray(setting)) {
    return setting;
  }
  const entries: readonly unknown[] = setting;
  return entries[0];
}

/** What breaks "the config turns on exactly the plugin's rules, as errors". */
function configProblems(config: unknown, rules: readonly string[]): readonly string[] {
  const fields = object(config, '.oxlintrc.json');
  const plugins = Array.isArray(fields['jsPlugins']) ? fields['jsPlugins'] : [];
  const problems = plugins.includes(PLUGIN_PATH) ? [] : [`jsPlugins does not load ${PLUGIN_PATH}`];
  const prefix = `${PLUGIN_NAME}/`;
  const configured = Object.entries(object(fields['rules'] ?? {}, 'rules')).filter(([name]) => name.startsWith(prefix));
  for (const [name, setting] of configured) {
    const rule = name.slice(prefix.length);
    const severity = level(setting);
    if (!rules.includes(rule)) {
      problems.push(`${name}: not a rule of the plugin`);
    } else if (severity !== 'error') {
      problems.push(`${name}: is ${JSON.stringify(severity)}, not "error"`);
    }
  }
  const on = new Set(configured.map(([name]) => name.slice(prefix.length)));
  problems.push(...rules.filter((rule) => !on.has(rule)).map((rule) => `${prefix}${rule}: not turned on`));
  return problems;
}

/** What breaks "the README's table lists exactly the rules, with their descriptions". */
function readmeProblems(readme: string, described: ReadonlyMap<string, string>): readonly string[] {
  const rows = new Map([...readme.matchAll(TABLE_ROW)].map((row) => [row[1] ?? '', row[2] ?? '']));
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

describe('the repository', () => {
  test('the plugin holds exactly the declared rules', () => {
    expect.hasAssertions();
    expect(ruleNames()).toStrictEqual([...DECLARED]);
  });

  test('every rule has must-fire and must-stay-clean fixtures, and every fixture folder a rule', () => {
    expect.hasAssertions();
    expect(fixtureProblems(ruleNames(), fixtureFolders(), fixtures())).toStrictEqual([]);
  });

  test('the config turns on exactly the plugin rules, and the README lists them', () => {
    expect.hasAssertions();
    expect(configProblems(json(textOf('.oxlintrc.json')), ruleNames())).toStrictEqual([]);
    expect(readmeProblems(textOf(README), descriptions())).toStrictEqual([]);
  });

  test('each must-fire fixture fails on its rule and each must-stay-clean fixture passes', () => {
    expect.hasAssertions();
    const planted = fixtures();
    const found = lintFixtures(planted);
    const outcome = planted.map((fixture) => {
      const codes = codesAt(found, fixture.path);
      const held = fixture.kind === 'fire' ? codes.includes(`${PLUGIN_NAME}(${fixture.rule})`) : codes.length === 0;
      return { codes, file: fixture.file, held };
    });
    expect(outcome.filter((entry) => !entry.held)).toStrictEqual([]);
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
    ).toStrictEqual([
      'fixtures/gone: no such rule',
      'env: no clean fixture',
      'json: no fire fixture',
    ]);
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
