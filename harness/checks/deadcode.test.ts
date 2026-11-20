/**
 * knip finds no unused file, dependency or export, in production mode and in default mode, and every ignore entry carries its reason.
 *
 * The `deadcode` task runs knip twice, each run treating a configuration hint as an error: in
 * production mode, where only `!` entries and project files count, an export only a test reads is
 * unused; in default mode, an export nothing reads is unused. knip hints a stale dependency,
 * binary or workspace ignore, so it fails; a stale `ignoreIssues` entry it does not, so this check
 * runs knip without them and fails an entry that covers no issue. Each entry of `knip.json`'s
 * ignore lists is held here with its reason.
 */

import { describe, expect, test } from 'vitest';

import { deadcodeRuns, ignoreEntries, knip, repoIgnoreEntries, staleIgnoreIssues } from '../lib/deadcode.ts';
import { json } from '../lib/config.ts';
import { textOf } from '../lib/source-files.ts';
import { Exemptions } from '../lib/exemptions.ts';
import { REPO_ROOT } from '../lib/paths.ts';
import { Project } from '../lib/tools.ts';

export const HARNESS_ID = 'deadcode';

const POC = 'poc: the POC reference uses it until it is deleted (#50)';
const CORE = 'adopting: core harness modules whose exports the other check groups consume; drop the entry once they do';

/** The ignore entries of knip.json, keyed as `ignoreEntries` keys them. */
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
  'adopting: removed with the eslint boundary lint once oxlint holds the boundaries': ['ignoreDependencies:@eslint/js'],
  'run by harness/scripts/dupes.ts through tools.bin, which knip cannot see': ['ignoreDependencies:jscpd'],
  'pinned by the view-layer brief; loaded by @solidjs/vite-plugin, not imported': ['ignoreDependencies:@solidjs/compiler'],
  'adopting: the characterisation package declares the vite its Playwright web server runs': [
    'ignoreIssues:packages/characterisation/playwright.characterisation.config.ts:binaries',
  ],
  [CORE]: [
    'ignoreIssues:harness/lib/checks.ts:files',
    'ignoreIssues:harness/lib/config.ts:exports',
    'ignoreIssues:harness/lib/exemptions.ts:exports',
    'ignoreIssues:harness/lib/paths.ts:exports',
    'ignoreIssues:harness/lib/process.ts:types',
    'ignoreIssues:harness/lib/projects.ts:exports',
    'ignoreIssues:harness/lib/scope.ts:exports',
    'ignoreIssues:harness/lib/source-files.ts:exports',
    'ignoreIssues:harness/lib/tools.ts:exports',
  ],
  'adopting: the characterisation fixtures of Step 1 read the result-bus helpers': [
    'ignoreIssues:packages/characterisation/src/harness.ts:exports',
    'ignoreIssues:packages/characterisation/tests/_helpers.ts:exports',
  ],
  'adopting: the chat kernel either reads these model exports or makes them module-private': [
    'ignoreIssues:packages/systems/chat/src/model/defer.ts:exports',
    'ignoreIssues:packages/systems/chat/src/model/read-state.ts:exports',
    'ignoreIssues:packages/systems/chat/src/model/route.ts:exports',
  ],
  'adopting: parseTimeOfDay is read only by its test; the chat kernel reads it or stops exporting it': [
    'ignoreIssues:packages/systems/chat/src/model/time.ts:exports',
  ],
  'adopting: ChatCommand is read only by tests; the view layer reads it when parts send chat commands': [
    'ignoreIssues:packages/systems/chat/src/system.ts:types',
  ],
  'adopting: the regression ledger exports only what its test reads': [
    'ignoreIssues:packages/systems/chat/test/regression-ledger.ts:exports',
    'ignoreIssues:packages/systems/chat/test/regression-ledger.ts:types',
  ],
});

const PLANT_CONFIG = {
  entry: ['src/index.ts!', 'src/**/*.test.ts'],
  project: ['src/**/*.ts!'],
};

/** A planted package with `files` and a knip config; `use` runs on its root before it is removed. */
function planted<T>(files: Readonly<Record<string, string>>, config: object, use: (root: string) => T): T {
  const project = new Project();
  try {
    project.write('package.json', JSON.stringify({ name: 'plant', version: '0.0.0', private: true, type: 'module' }));
    project.write('knip.json', JSON.stringify(config));
    for (const [path, text] of Object.entries(files)) {
      project.write(path, text);
    }
    return use(project.root);
  } finally {
    project.remove();
  }
}

/** Run every knip invocation of the deadcode task on a planted package; their exit statuses and output. */
function plantedRuns(files: Readonly<Record<string, string>>, config: object = PLANT_CONFIG): readonly { status: number; output: string }[] {
  return planted(files, config, (root) =>
    deadcodeRuns().map((args) => {
      const run = knip(root, args);
      return { status: run.status, output: run.stdout + run.stderr };
    }),
  );
}

const CLEAN = {
  'src/index.ts': "export { a } from './lib.ts';\n",
  'src/lib.ts': 'export const a = 1;\n',
  'src/lib.test.ts': "import { a } from './lib.ts';\nconsole.assert(a === 1);\n",
};

describe('the repository', () => {
  test('the deadcode task runs knip in production mode and in default mode, treating hints as errors', () => {
    expect(deadcodeRuns()).toEqual([
      ['--production', '--treat-config-hints-as-errors'],
      ['--treat-config-hints-as-errors'],
    ]);
  });

  test('knip finds nothing unused in either mode', () => {
    const failed = deadcodeRuns()
      .map((args) => knip(REPO_ROOT, args))
      .filter((run) => run.status !== 0)
      .map((run) => run.stdout + run.stderr);
    expect(failed).toEqual([]);
  });

  test('every ignore entry of knip.json carries its reason', () => {
    expect(KNIP_IGNORES.unexempted(repoIgnoreEntries())).toEqual([]);
  });

  test('every ignoreIssues entry covers an issue', () => {
    expect(staleIgnoreIssues(REPO_ROOT, json(textOf('knip.json')))).toEqual([]);
  });
});

describe('the deadcode check, on a planted package', () => {
  test('passes a package whose every export is read by production code', () => {
    expect(plantedRuns(CLEAN).map((run) => run.status)).toEqual([0, 0]);
  });

  test('fails an export nothing reads, in both modes', () => {
    const runs = plantedRuns({ ...CLEAN, 'src/lib.ts': 'export const a = 1;\nexport const unread = 2;\n' });
    expect(runs.map((run) => [run.status, run.output.includes('unread')])).toEqual([
      [1, true],
      [1, true],
    ]);
  });

  test('fails an export only a test reads, in production mode only', () => {
    const runs = plantedRuns({
      ...CLEAN,
      'src/lib.ts': 'export const a = 1;\nexport const testOnly = 2;\n',
      'src/lib.test.ts': "import { a, testOnly } from './lib.ts';\nconsole.assert(a + testOnly === 3);\n",
    });
    expect(runs.map((run) => [run.status, run.output.includes('testOnly')])).toEqual([
      [1, true],
      [0, false],
    ]);
  });

  test('fails a stale dependency ignore, which knip hints in default mode', () => {
    const runs = plantedRuns(CLEAN, { ...PLANT_CONFIG, ignoreDependencies: ['no-such-package'] });
    expect(runs.map((run) => [run.status, run.output.includes('no-such-package')])).toEqual([
      [0, false],
      [1, true],
    ]);
  });

  test('sees an ignoreIssues entry that covers nothing, and lets one that covers an issue through', () => {
    const unread = { ...CLEAN, 'src/lib.ts': 'export const a = 1;\nexport const unread = 2;\n' };
    const config = { ...PLANT_CONFIG, ignoreIssues: { 'src/lib.ts': ['exports'], 'src/index.ts': ['exports'] } };
    expect(planted(unread, config, (root) => staleIgnoreIssues(root, config))).toEqual(['ignoreIssues:src/index.ts:exports']);
    expect(plantedRuns(unread, config).map((run) => run.status)).toEqual([0, 0]);
  });

  test('keys every kind of ignore entry', () => {
    expect(
      ignoreEntries({
        ignoreWorkspaces: ['w'],
        ignoreDependencies: ['d'],
        ignoreBinaries: ['b'],
        ignoreFiles: ['f'],
        ignoreIssues: { 'src/x.ts': ['exports', 'types'] },
      }),
    ).toEqual([
      'ignoreWorkspaces:w',
      'ignoreDependencies:d',
      'ignoreBinaries:b',
      'ignoreFiles:f',
      'ignoreIssues:src/x.ts:exports',
      'ignoreIssues:src/x.ts:types',
    ]);
  });
});
