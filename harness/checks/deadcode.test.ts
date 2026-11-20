/**
 * knip, at its strictest, finds no unused file, dependency or export in production mode or default mode, and every ignore entry carries its reason.
 *
 * The `deadcode` task runs knip twice, each run treating a configuration hint as an error: in
 * production mode, where only `!` entries and project files count, an export only a test reads is
 * unused; in default mode, an export nothing reads is unused. Every issue type knip's schema names
 * is an error, and no file is excused from one. knip hints a stale dependency, binary or workspace
 * ignore, so it fails. Each entry of `knip.json`'s ignore lists is held here with its reason.
 */

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

const POC = 'poc: the POC reference uses it until it is deleted (#50)';

/**
 * The ignore entries of knip.json, keyed as `ignoreEntries` keys them. Each covers something knip
 * cannot see: code outside the harness's scope, or a package loaded by a tool rather than imported.
 */
const KNIP_IGNORES = Exemptions.grouped({
  'poc: the POC reference is outside the harness until it is deleted (#50)': [
    'ignoreWorkspaces:packages/framework',
    'ignoreWorkspaces:packages/tests',
    'ignoreWorkspaces:packages/test-utils',
    'ignoreWorkspaces:experiences/aricanga',
  ],
  [POC]: [
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
  'pinned by the view-layer brief; loaded by @solidjs/vite-plugin, not imported': ['ignoreDependencies:@solidjs/compiler'],
});

const PLANT_CONFIG = {
  entry: ['src/index.ts!', 'src/**/*.test.ts'],
  project: ['src/**/*.ts!'],
};

/**
 * Run every knip invocation of the deadcode task on a planted package; their exit statuses and output.
 *
 * @param {Readonly<Record<string, string>>} files - The files.
 * @param {object} config - The config.
 * @returns {readonly { status: number; output: string }[]} Each run's exit status and output.
 */
function plantedRuns(
  files: Readonly<Record<string, string>>,
  config: object = PLANT_CONFIG,
): readonly { status: number; output: string }[] {
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
    const failed = deadcodeRuns()
      .map((args) => knip(REPO_ROOT, args))
      .filter((run) => run.status !== 0)
      .map((run) => run.stdout + run.stderr);
    expect(failed).toStrictEqual([]);
  });

  test('every ignore entry of knip.json carries its reason', () => {
    expect.hasAssertions();
    expect(KNIP_IGNORES.unexempted(repoIgnoreEntries())).toStrictEqual([]);
  });

  test('knip.json is at the strictest: every issue type an error, no file excused', () => {
    expect.hasAssertions();
    expect(issueTypes()).toContain('exports');
    expect(strictnessProblems(json(textOf('knip.json')), issueTypes())).toStrictEqual([]);
  });
});

describe('the deadcode check, on a planted package', () => {
  test('passes a package whose every export is read by production code', () => {
    expect.hasAssertions();
    expect(plantedRuns(CLEAN).map((run) => run.status)).toStrictEqual([0, 0]);
  });

  test('fails an export nothing reads, in both modes', () => {
    expect.hasAssertions();
    const runs = plantedRuns({ ...CLEAN, 'src/lib.ts': 'export const a = 1;\nexport const unread = 2;\n' });
    expect(runs.map((run) => [run.status, run.output.includes('unread')])).toStrictEqual([
      [1, true],
      [1, true],
    ]);
  });

  test('fails an export only a test reads, in production mode only', () => {
    expect.hasAssertions();
    const runs = plantedRuns({
      ...CLEAN,
      'src/lib.test.ts': "import { a, testOnly } from './lib.ts';\nconsole.assert(a + testOnly === 3);\n",
      'src/lib.ts': 'export const a = 1;\nexport const testOnly = 2;\n',
    });
    expect(runs.map((run) => [run.status, run.output.includes('testOnly')])).toStrictEqual([
      [1, true],
      [0, false],
    ]);
  });

  test('fails a stale dependency ignore, which knip hints in default mode', () => {
    expect.hasAssertions();
    const runs = plantedRuns(CLEAN, { ...PLANT_CONFIG, ignoreDependencies: ['no-such-package'] });
    expect(runs.map((run) => [run.status, run.output.includes('no-such-package')])).toStrictEqual([
      [0, false],
      [1, true],
    ]);
  });

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
