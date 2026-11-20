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
 * config turns off, at the top level or in an override, is declared with its reason.
 */

import { describe, expect, test } from 'vitest';

import { json, object } from '../lib/config.ts';
import { Accepted, Exemptions } from '../lib/exemptions.ts';
import { textOf } from '../lib/source-files.ts';
import { finished, Project } from '../lib/tools.ts';
import { fromRoot } from '../lib/paths.ts';

export const HARNESS_ID = 'lint-settings';

/** oxlint's rule categories: the config turns every one on at error. */
const CATEGORIES = new Accepted(['correctness', 'suspicious', 'perf', 'pedantic', 'style', 'restriction', 'nursery']);

/**
 * The rules the config turns off, each with its reason: the enabled rule it contradicts, or the
 * mirrored config that turns it off. A rule turned off and not listed fails, and so does an entry
 * the config no longer turns off.
 */
const TURNED_OFF = Exemptions.grouped({
  'off in eslint-plugin-solid v2-strict, which the config mirrors exactly (the v2-strict test below)': [
    'solid/no-react-deps',
    'solid/no-array-handlers',
    'solid/prefer-show',
    'solid/no-proxy-apis',
    'solid/prefer-classlist',
  ],
});

const UNUSED_DIRECTIVE = 'unused-disable-directive';

/** Each plant's text and the rule codes oxlint must report for it, exactly. */
const PLANTS: Readonly<Record<string, readonly [string, readonly string[]]>> = {
  'src/explicit-any.ts': ['export const value: any = 1;\n', ['typescript(no-explicit-any)']],
  'src/ts-ignore.ts': ['// @ts-ignore\nexport const value = 1;\n', ['typescript(ban-ts-comment)']],
  'src/ts-expect-bare.ts': ['// @ts-expect-error\nexport const value: string = 1;\n', ['typescript(ban-ts-comment)']],
  'src/floating.ts': [
    'async function work(): Promise<void> {}\nexport function start(): void {\n  work();\n}\n',
    ['typescript(no-floating-promises)'],
  ],
  'src/unsafe-assignment.ts': ["export const value: number = JSON.parse('1');\n", ['typescript(no-unsafe-assignment)']],
  'src/unsafe-member.ts': [
    "export function read(): void {\n  void JSON.parse('{}').field;\n}\n",
    ['typescript(no-unsafe-member-access)'],
  ],
  'src/unsafe-call.ts': ["export function call(): void {\n  JSON.parse('{}')();\n}\n", ['typescript(no-unsafe-call)']],
  'src/unsafe-return.ts': ["export function read(): number {\n  return JSON.parse('1');\n}\n", ['typescript(no-unsafe-return)']],
  'src/unsafe-argument.ts': [
    "function twice(value: number): number {\n  return value * 2;\n}\nexport const result = twice(JSON.parse('1'));\n",
    ['typescript(no-unsafe-argument)'],
  ],
  'src/console.ts': ["export function say(): void {\n  console.log('x');\n}\n", ['eslint(no-console)']],
  'src/switch.ts': [
    "export function name(kind: 'a' | 'b'): string {\n  switch (kind) {\n    case 'a':\n      return 'A';\n  }\n  return '';\n}\n",
    ['typescript(switch-exhaustiveness-check)'],
  ],
  'src/type-import.ts': [
    "import { Shape } from './types';\nexport const shape: Shape = { kind: 'a' };\n",
    ['typescript(consistent-type-imports)'],
  ],
  'src/focused.test.ts': [
    "import { expect, test } from 'vitest';\ntest.only('a', () => {\n  expect(1).toBe(1);\n});\n",
    ['vitest(no-focused-tests)'],
  ],
  'src/disabled.test.ts': [
    "import { expect, test } from 'vitest';\ntest.skip('a', () => {\n  expect(1).toBe(1);\n});\n",
    ['vitest(no-disabled-tests)'],
  ],
  'src/unused-directive.ts': ['// oxlint-disable-next-line no-console\nexport const value = 1;\n', [UNUSED_DIRECTIVE]],
  'src/eslint-directive.ts': [
    "export function say(): void {\n  // eslint-disable-next-line no-console\n  console.log('x');\n}\n",
    ['eslint(no-console)'],
  ],
  'src/destructure.tsx': [
    'export function Bubble({ vm }: { vm: { text: string } }): unknown {\n  return <p>{vm.text}</p>;\n}\n',
    ['aricanga(vm-prop)', 'solid(no-destructure)'],
  ],
  'src/expect-described.ts': ['// @ts-expect-error: the planted mismatch this check needs\nexport const value: string = 1;\n', []],
  'src/types.ts': ['export interface Shape {\n  readonly kind: string;\n}\n', []],
  'src/clean.ts': ['export function double(value: number): number {\n  return value * 2;\n}\n', []],
};

const WARNING_PLANT = 'src/warning.ts';
const WARNING_TEXT = 'export function stop(): void {\n  debugger;\n}\n';

type Options = Readonly<Record<string, unknown>>;

/** A copy of the repository's oxlint config with `options` merged over its options; a local JS plugin is read from the repository. */
function config(options: Options, rules: Options = {}): string {
  const repo = object(json(textOf('.oxlintrc.json')), '.oxlintrc.json');
  const plugins = Array.isArray(repo.jsPlugins) ? repo.jsPlugins.map(String) : [];
  return JSON.stringify({
    ...repo,
    jsPlugins: plugins.map((plugin) => (plugin.startsWith('./') ? fromRoot(plugin) : plugin)),
    options: { ...object(repo.options ?? {}, 'options'), ...options },
    rules: { ...object(repo.rules ?? {}, 'rules'), ...rules },
  });
}

interface Lint {
  readonly status: number;
  readonly codes: ReadonlyMap<string, readonly string[]>;
}

/** The rule codes of oxlint's JSON report, by file. */
export function codesByFile(report: unknown): ReadonlyMap<string, readonly string[]> {
  const diagnostics = object(report, 'oxlint report').diagnostics;
  const found = new Map<string, string[]>();
  for (const entry of Array.isArray(diagnostics) ? diagnostics : []) {
    const fields = object(entry, 'diagnostic');
    const file = typeof fields.filename === 'string' ? fields.filename : '';
    const message = typeof fields.message === 'string' ? fields.message : '';
    const code = typeof fields.code === 'string' ? fields.code : message.startsWith('Unused ') ? UNUSED_DIRECTIVE : message;
    found.set(file, [...new Set([...(found.get(file) ?? []), code])].toSorted());
  }
  return found;
}

/** One run of the locked oxlint over `files` in a planted project under `configText`. */
function lint(files: Readonly<Record<string, string>>, configText: string): Lint {
  const project = new Project({ copies: ['tsconfig.base.json'] });
  try {
    project.write('.oxlintrc.json', configText);
    project.write(
      'tsconfig.json',
      JSON.stringify({ extends: './tsconfig.base.json', compilerOptions: { types: [], jsx: 'preserve' }, include: ['src'] }),
    );
    for (const [path, text] of Object.entries(files)) {
      project.write(path, text);
    }
    const done = project.tool('oxlint', '-c', '.oxlintrc.json', '--format', 'json', ...Object.keys(files));
    return { status: done.status, codes: codesByFile(json(done.stdout)) };
  } finally {
    project.remove();
  }
}

const SEVERITY = /^(?:off|0)$/;

/** The rules a config turns on, among those named with `prefix`. */
export function enabled(rules: Options, prefix: string): readonly string[] {
  return Object.entries(rules)
    .filter(([rule, setting]) => {
      let level: unknown = setting;
      if (Array.isArray(setting)) {
        const parts: readonly unknown[] = setting;
        level = parts[0];
      }
      return rule.startsWith(prefix) && !SEVERITY.test(String(level));
    })
    .map(([rule]) => rule)
    .toSorted();
}

/** The rules a config turns off, at the top level and in every override. */
export function turnedOff(configText: unknown): readonly string[] {
  const repo = object(configText, '.oxlintrc.json');
  const overrides = Array.isArray(repo.overrides) ? repo.overrides : [];
  const ruleSets = [repo.rules ?? {}, ...overrides.map((entry) => object(entry, 'override').rules ?? {})];
  const off = ruleSets.flatMap((rules) => {
    const all = object(rules, 'rules');
    const on = new Set(enabled(all, ''));
    return Object.keys(all).filter((rule) => !on.has(rule));
  });
  return [...new Set(off)].toSorted();
}

/** The categories a config does not turn on at error. */
export function categoryProblems(configText: unknown): readonly string[] {
  const categories = object(object(configText, '.oxlintrc.json').categories ?? {}, 'categories');
  return [...CATEGORIES].filter((category) => categories[category] !== 'error').map((category) => `${category} is not at error`);
}

/** eslint-plugin-solid's `v2-strict` rules, read from the locked plugin. */
function v2Strict(): Options {
  const done = finished(
    [
      process.execPath,
      '--input-type=module',
      '-e',
      "const m = await import('eslint-plugin-solid/configs/v2-strict'); process.stdout.write(JSON.stringify(m.default.rules));",
    ],
    { cwd: fromRoot() },
  );
  return object(json(done.stdout), 'v2-strict rules');
}

describe('the repository config', () => {
  test('fails each planted violation with exactly its rule, and passes the near misses', () => {
    const files = Object.fromEntries(Object.entries(PLANTS).map(([path, [text]]) => [path, text]));
    const found = lint(files, config({})).codes;
    expect(Object.fromEntries(Object.keys(PLANTS).map((path) => [path, found.get(path) ?? []]))).toEqual(
      Object.fromEntries(Object.entries(PLANTS).map(([path, [, codes]]) => [path, codes])),
    );
  });

  test('turns on exactly the rules of eslint-plugin-solid v2-strict, loaded as a JS plugin', () => {
    const repo = object(json(textOf('.oxlintrc.json')), '.oxlintrc.json');
    const plugins = Array.isArray(repo.jsPlugins) ? repo.jsPlugins : [];
    expect(plugins).toContain('eslint-plugin-solid');
    expect(enabled(object(repo.rules ?? {}, 'rules'), 'solid/')).toEqual(enabled(v2Strict(), 'solid/'));
  });
});

describe('the strictness of the config', () => {
  test('turns every category on at error', () => {
    expect(categoryProblems(json(textOf('.oxlintrc.json')))).toEqual([]);
  });

  test('declares every rule it turns off with its reason', () => {
    expect(TURNED_OFF.unexempted(turnedOff(json(textOf('.oxlintrc.json'))))).toEqual([]);
  });

  test('sees a category left out or below error, and a rule turned off at the top or in an override', () => {
    expect(categoryProblems({ categories: { correctness: 'error', style: 'warn' } })).toEqual([
      'nursery is not at error',
      'pedantic is not at error',
      'perf is not at error',
      'restriction is not at error',
      'style is not at error',
      'suspicious is not at error',
    ]);
    expect(turnedOff({ rules: { a: 'off', b: 'error' }, overrides: [{ files: ['x'], rules: { c: ['off'], d: 'warn' } }] })).toEqual(['a', 'c']);
  });
});

describe('each option, by removal', () => {
  test('denyWarnings: a lone warning fails the run, and passes without it', () => {
    const warn = { 'eslint/no-debugger': 'warn' };
    expect(lint({ [WARNING_PLANT]: WARNING_TEXT }, config({}, warn)).status).toBe(1);
    expect(lint({ [WARNING_PLANT]: WARNING_TEXT }, config({ denyWarnings: false }, warn)).status).toBe(0);
  });

  test('reportUnusedDisableDirectives: an unused directive passes without it', () => {
    const [text] = PLANTS['src/unused-directive.ts'] ?? ['', []];
    expect(lint({ 'src/unused-directive.ts': text }, config({ reportUnusedDisableDirectives: 'off' })).status).toBe(0);
  });

  test('respectEslintDisableDirectives: false, an eslint-disable comment silences its rule once respected', () => {
    const [text] = PLANTS['src/eslint-directive.ts'] ?? ['', []];
    expect(lint({ 'src/eslint-directive.ts': text }, config({ respectEslintDisableDirectives: true })).status).toBe(0);
  });
});

describe('the rule comparison', () => {
  test('sees a missing, an extra and a disabled rule, and reads severities', () => {
    expect(enabled({ 'solid/a': 'error', 'solid/b': 2, 'solid/c': 'off', 'solid/d': ['warn', {}], other: 'error' }, 'solid/')).toEqual([
      'solid/a',
      'solid/b',
      'solid/d',
    ]);
    expect(enabled({ 'solid/a': 0 }, 'solid/')).toEqual([]);
  });
});
