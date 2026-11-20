/**
 * `knip`, at its strictest, finds no unused file, dependency or export in production mode or default mode, and every ignore entry carries its reason.
 *
 * The `deadcode` task runs knip twice, each run treating a configuration hint as an error: in
 * production mode, where only `!` entries and project files count, an export only a test reads is
 * unused; in default mode, an export nothing reads is unused. Every issue type knip's schema names
 * is an error, and no file is excused from one. knip hints a stale dependency, binary or workspace
 * ignore, so it fails. Each entry of `knip.json`'s ignore lists is held here with its reason.
 */

import { EXIT_CLEAN, EXIT_FINDINGS } from './exit-status.ts';
import {
  deadcodeRuns,
  ignoreEntries,
  issueTypes,
  knip,
  repoIgnoreEntries,
  strictnessProblems,
} from '#lib/deadcode.ts';
import { describe, expect, test } from 'vitest';
import { Exemptions } from '#lib/exemptions.ts';
import { Project } from '#lib/tools.ts';
import { REPO_ROOT } from '#lib/paths.ts';
import { json } from '#lib/config.ts';
import { textOf } from '#lib/source-files.ts';

const HARNESS_ID = 'deadcode';

/**
 * The ignore entries of knip.json, keyed as `ignoreEntries` keys them. Each covers something knip
 * cannot see: code outside the harness's scope, or a package loaded by a tool rather than imported.
 */
const KNIP_IGNORES = Exemptions.grouped({
  'pinned by the view-layer brief; loaded by @solidjs/vite-plugin, not imported': ['ignoreDependencies:@solidjs/compiler'],
  'poc: the POC reference is outside the harness until it is deleted (#50)': [
    'ignoreWorkspaces:packages/framework',
    'ignoreWorkspaces:packages/tests',
    'ignoreWorkspaces:packages/test-utils',
    'ignoreWorkspaces:experiences/aricanga',
  ],
  'poc: the POC reference uses it until it is deleted (#50)': [
    'ignoreDependencies:@ai-sdk/anthropic',
    'ignoreDependencies:@ai-sdk/google',
    'ignoreDependencies:@ai-sdk/openai',
    'ignoreDependencies:@narratives/framework',
    'ignoreDependencies:@narratives/test-utils',
    'ignoreDependencies:@viz-js/viz',
    'ignoreDependencies:ai',
    'ignoreDependencies:remark-parse',
    'ignoreDependencies:unified',
    'ignoreDependencies:unist-util-visit',
    'ignoreDependencies:xstate',
    'ignoreDependencies:zod',
  ],
  'run by harness/scripts/dupes.ts through tools.bin, which knip cannot see': ['ignoreDependencies:jscpd'],
});

/** A planted package's run: its exit status and output. */
interface Run {
  readonly status: number;
  readonly output: string;
}

const PLANT_CONFIG = {
  entry: ['src/index.ts!', 'src/**/*.test.ts'],
  project: ['src/**/*.ts!'],
};

/**
 * Run every knip invocation of the deadcode task on a planted package; their exit statuses and output.
 *
 * @param {Readonly<Record<string, string>>} files - The files.
 * @param {object} config - The config.
 * @returns {readonly Run[]} Each run's exit status and output.
 */
function plantedRuns(files: Readonly<Record<string, string>>, config: object = PLANT_CONFIG): readonly Run[] {
  const project = new Project();
  try {
    project.write('package.json', JSON.stringify({ name: 'plant', private: true, type: 'module', version: '0.0.0' }));
    project.write('knip.json', JSON.stringify(config));
    for (const [path, text] of Object.entries(files)) {
      project.write(path, text);
    }
    return deadcodeRuns().map((args) => {
      const run = knip(project.root, args);
      return { output: run.stdout + run.stderr, status: run.status };
    });
  } finally {
    project.remove();
  }
}

/**
 * Each run's exit status, and whether its output names `name`.
 *
 * @param {readonly Run[]} runs - The runs.
 * @param {string} name - The name the output should hold.
 * @returns {readonly (readonly [number, boolean])[]} Each run's status and whether it named `name`.
 */
function statusAndNamed(runs: readonly Run[], name: string): readonly (readonly [number, boolean])[] {
  return runs.map((run) => [run.status, run.output.includes(name)] as const);
}

/**
 * The output of every repository run of knip that did not exit clean.
 *
 * @returns {readonly string[]} Each failed run's output.
 */
function failedRepoRuns(): readonly string[] {
  return deadcodeRuns()
    .map((args) => knip(REPO_ROOT, args))
    .filter((run) => run.status !== EXIT_CLEAN)
    .map((run) => run.stdout + run.stderr);
}

const CLEAN = {
  'src/index.ts': "export { a } from './lib.ts';\n",
  'src/lib.test.ts': "import { a } from './lib.ts';\nconsole.assert(a === 1);\n",
  'src/lib.ts': 'export const a = 1;\n',
};

describe('the repository', () => {
  test('the deadcode task runs knip in production mode and in default mode, treating hints as errors', () => {
    expect.hasAssertions();
    expect(deadcodeRuns()).toStrictEqual([
      ['--production', '--treat-config-hints-as-errors'],
      ['--treat-config-hints-as-errors'],
    ]);
  });

  test('knip finds nothing unused in either mode', () => {
    expect.hasAssertions();
    expect(failedRepoRuns()).toStrictEqual([]);
  });

  test('every ignore entry of knip.json carries its reason', () => {
    expect.hasAssertions();
    expect(KNIP_IGNORES.unexempted(repoIgnoreEntries())).toStrictEqual([]);
  });

  test('knip.json is at the strictest: every issue type an error, no file excused', () => {
    expect.hasAssertions();
    expect(issueTypes()).toContain('exports');
    const config = json(textOf('knip.json'));
    expect(strictnessProblems(config, issueTypes())).toStrictEqual([]);
  });
});

describe('the deadcode check, on a planted package', () => {
  test('passes a package whose every export is read by production code', () => {
    expect.hasAssertions();
    expect(statusAndNamed(plantedRuns(CLEAN), 'unread')).toStrictEqual([
      [EXIT_CLEAN, false],
      [EXIT_CLEAN, false],
    ]);
  });

  test('fails an export nothing reads, in both modes', () => {
    expect.hasAssertions();
    const runs = plantedRuns({ ...CLEAN, 'src/lib.ts': 'export const a = 1;\nexport const unread = 2;\n' });
    expect(statusAndNamed(runs, 'unread')).toStrictEqual([
      [EXIT_FINDINGS, true],
      [EXIT_FINDINGS, true],
    ]);
  });

  test('fails an export only a test reads, in production mode only', () => {
    expect.hasAssertions();
    const runs = plantedRuns({
      ...CLEAN,
      'src/lib.test.ts': "import { a, testOnly } from './lib.ts';\nconsole.assert(a + testOnly === 3);\n",
      'src/lib.ts': 'export const a = 1;\nexport const testOnly = 2;\n',
    });
    expect(statusAndNamed(runs, 'testOnly')).toStrictEqual([
      [EXIT_FINDINGS, true],
      [EXIT_CLEAN, false],
    ]);
  });

  test('fails a stale dependency ignore, which knip hints in default mode', () => {
    expect.hasAssertions();
    const runs = plantedRuns(CLEAN, { ...PLANT_CONFIG, ignoreDependencies: ['no-such-package'] });
    expect(statusAndNamed(runs, 'no-such-package')).toStrictEqual([
      [EXIT_CLEAN, false],
      [EXIT_FINDINGS, true],
    ]);
  });

});

describe('the deadcode check, on planted configs', () => {
  test('refuses an issue type below error and a file excused from an issue type', () => {
    expect.hasAssertions();
    const strict = { rules: { exports: 'error', types: 'error' } };
    expect(strictnessProblems(strict, ['exports', 'types'])).toStrictEqual([]);
    expect(
      strictnessProblems(
        { ignoreFiles: ['src/y.ts'], ignoreIssues: { 'src/x.ts': ['exports'] }, rules: { exports: 'warn' } },
        ['exports', 'types'],
      ),
    ).toStrictEqual([
      'rule exports is not error',
      'rule types is not error',
      'a file is excused: ignoreFiles:src/y.ts',
      'a file is excused: ignoreIssues:src/x.ts:exports',
    ]);
  });

  test('keys every kind of ignore entry', () => {
    expect.hasAssertions();
    expect(
      ignoreEntries({
        ignoreBinaries: ['b'],
        ignoreDependencies: ['d'],
        ignoreFiles: ['f'],
        ignoreIssues: { 'src/x.ts': ['exports', 'types'] },
        ignoreWorkspaces: ['w'],
      }),
    ).toStrictEqual([
      'ignoreWorkspaces:w',
      'ignoreDependencies:d',
      'ignoreBinaries:b',
      'ignoreFiles:f',
      'ignoreIssues:src/x.ts:exports',
      'ignoreIssues:src/x.ts:types',
    ]);
  });
});

export { HARNESS_ID };
