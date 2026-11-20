/**
 * The file listing is over its floor, and every held TypeScript file is reached by every tool's scan set.
 *
 * The scan sets: oxlint's own file list (`oxlint --debug=files`); oxfmt's, read by planting every held
 * file unformatted in a copy of the checkout and listing what `oxfmt --list-different` would change;
 * the TypeScript projects of `harness/lib/projects.ts`, each listing its files (`tsc --listFilesOnly`):
 * every file is held (listed under the project's own directory) by a project, by no more than one
 * production project, and no test file by a production project; Vitest's coverage `include` for every file that is not a test; jscpd's roots,
 * held by the clones check's own coverage of the listing; and knip's, once `knip.json` declares it.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { isTestInfrastructure } from '../lib/checker.ts';
import { object } from '../lib/config.ts';
import { Exemptions } from '../lib/exemptions.ts';
import { matches } from '../lib/globs.ts';
import { REPO_ROOT, fromRoot } from '../lib/paths.ts';
import { projects } from '../lib/projects.ts';
import { relativeTo } from '../lib/relative.ts';
import { typescriptFiles } from '../lib/scope.ts';
import { FLOOR, ListingError, listing, textOf, tracked } from '../lib/source-files.ts';
import { Project, finished } from '../lib/tools.ts';
import gate from '../../vitest.gate.config.ts';

export const HARNESS_ID = 'scan-sets';

/** Held files a scan set leaves out while the gap is being closed, keyed by `<path>: <scan set>`. */
const UNREACHED = Exemptions.grouped({
  'adopting: configuration modules no test imports; include them in coverage and import them from the settings checks': [
    'experiences/sandbox/vite.config.ts: coverage',
    'vitest.gate.config.ts: coverage',
  ],
  'adopting: the project lint-rules plugin runs inside oxlint; include harness/lint-rules in coverage and load its rules in-process from the lint-rules check': [
    'harness/lint-rules/ast.ts: coverage',
    'harness/lint-rules/plugin.ts: coverage',
    'harness/lint-rules/rules/autofocus.ts: coverage',
    'harness/lint-rules/rules/controlled.ts: coverage',
    'harness/lint-rules/rules/env.ts: coverage',
    'harness/lint-rules/rules/flags.ts: coverage',
    'harness/lint-rules/rules/imports.ts: coverage',
    'harness/lint-rules/rules/json.ts: coverage',
    'harness/lint-rules/rules/labels.ts: coverage',
    'harness/lint-rules/rules/legacy.ts: coverage',
    'harness/lint-rules/rules/mechanics.ts: coverage',
    'harness/lint-rules/rules/mirrors.ts: coverage',
    'harness/lint-rules/rules/promises.ts: coverage',
    'harness/lint-rules/rules/statics.ts: coverage',
    'harness/lint-rules/rules/store-owner.ts: coverage',
    'harness/lint-rules/rules/style-prop.ts: coverage',
    'harness/lint-rules/rules/sync-parts.ts: coverage',
    'harness/lint-rules/rules/view-imports.ts: coverage',
    'harness/lint-rules/rules/vm-prop.ts: coverage',
  ],
});

/** Project problems carried while the gap is being closed, keyed by the problem. */
const UNPROJECTED = Exemptions.grouped({
  'adopting: add vite.config.ts to the sandbox projects, so its build config is type-checked': [
    'experiences/sandbox/vite.config.ts: in no TypeScript project',
  ],
});

const TEST_FILE = /(\.test\.tsx?$|\/test\/|^harness\/checks\/|^packages\/characterisation\/tests\/)/;
const PRODUCTION_PROJECT = /^(packages\/(foundation|systems\/[^/]+)|experiences\/[^/]+)\/tsconfig\.json$/;
const UNFORMATTED = '\nconst   plantedUnformatted   =   1  ;\n';

/** Each held file with the scan sets that miss it, as `<path>: <scan set>`. */
export function unreached(files: readonly string[], sets: Readonly<Record<string, ReadonlySet<string>>>): readonly string[] {
  return files.flatMap((path) => Object.entries(sets).filter(([, reached]) => !reached.has(path)).map(([name]) => `${path}: ${name}`));
}

/** The project problems: a file in no project, in two production projects, or a test in a production project. */
export function projectProblems(files: readonly string[], members: ReadonlyMap<string, ReadonlySet<string>>): readonly string[] {
  return files.flatMap((path) => {
    const holding = [...members].filter(([, set]) => set.has(path)).map(([project]) => project);
    const production = holding.filter((project) => PRODUCTION_PROJECT.test(project));
    if (holding.length === 0) {
      return [`${path}: in no TypeScript project`];
    }
    if (production.length > 1) {
      return [`${path}: in ${production.length} production projects`];
    }
    return TEST_FILE.test(path) && production.length > 0 ? [`${path}: a test in the production project ${production[0] ?? ''}`] : [];
  });
}

/** The files oxlint lints in the checkout, from its own listing. */
function oxlintFiles(): ReadonlySet<string> {
  const done = finished([fromRoot('node_modules', '.bin', 'oxlint'), '--debug=files'], { cwd: REPO_ROOT });
  return new Set(done.stdout.split('\n').filter((line) => line !== ''));
}

/** The files oxfmt formats: every held file planted unformatted in a copy of the checkout's config. */
function oxfmtFiles(files: readonly string[]): ReadonlySet<string> {
  const ignores = ['.gitignore', '.prettierignore', '.oxfmtrc.json'].filter((path) => tracked().includes(path));
  const project = new Project({ copies: ignores });
  try {
    for (const path of files) {
      project.write(path, textOf(path) + UNFORMATTED);
    }
    const done = project.tool('oxfmt', '--list-different');
    return new Set(done.stdout.split('\n').filter((line) => line !== ''));
  } finally {
    project.remove();
  }
}

/** The directory a project file sits in, with a trailing slash (empty at the root). */
export function projectDirectory(project: string): string {
  const at = project.lastIndexOf('/');
  return at === -1 ? '' : project.slice(0, at + 1);
}

/**
 * The files each TypeScript project holds: those it lists (`tsc --listFilesOnly`) under its own
 * directory. A package's source a dependent project resolves through the package's exports is
 * listed there too, but held by its own package.
 */
function projectMembers(): ReadonlyMap<string, ReadonlySet<string>> {
  return new Map(
    projects().map((project) => {
      const done = finished([fromRoot('node_modules', '.bin', 'tsc'), '--listFilesOnly', '-p', project], { cwd: REPO_ROOT });
      const listed = done.stdout.split('\n').filter((line) => line !== '').map((path) => relativeTo(REPO_ROOT, path));
      return [project, new Set(listed.filter((path) => path.startsWith(projectDirectory(project))))];
    }),
  );
}

/** The non-test files Vitest's coverage `include` reaches and its `exclude` does not take back. */
function coverageReached(files: readonly string[]): ReadonlySet<string> {
  const coverage = object(object(object(gate, 'vitest.gate.config.ts')['test'], 'test')['coverage'], 'coverage');
  const include = Array.isArray(coverage['include']) ? coverage['include'].map(String) : [];
  const exclude = Array.isArray(coverage['exclude']) ? coverage['exclude'].map(String) : [];
  return new Set(
    files.filter(
      (path) => TEST_FILE.test(path) || isTestInfrastructure(path) || (include.some((glob) => matches(glob, path)) && !exclude.some((glob) => matches(glob, path))),
    ),
  );
}

describe('the listing', () => {
  test('is over its floor', () => {
    expect(tracked().length).toBeGreaterThanOrEqual(FLOOR);
  });

  test('refuses a short listing instead of scanning nothing', () => {
    expect(() => listing('', tmpdir())).toThrow(ListingError);
  });

  test('refuses a folder git cannot list', () => {
    const folder = mkdtempSync(join(tmpdir(), 'unlisted-'));
    try {
      expect(() => tracked(folder)).toThrow(ListingError);
    } finally {
      rmSync(folder, { force: true, recursive: true });
    }
  });

  test('keeps existing files only', () => {
    const project = new Project({ linkModules: false });
    try {
      const names = Array.from({ length: FLOOR }, (_, index) => `f${index}.ts`);
      for (const name of names) {
        project.write(name, '');
      }
      expect(listing([...names, 'deleted.ts', ''].join('\0'), project.root)).toEqual(names.toSorted());
    } finally {
      project.remove();
    }
  });
});

describe('the repository', () => {
  test('every held TypeScript file is reached by oxlint, oxfmt and coverage', () => {
    const files = typescriptFiles();
    const found = unreached(files, { coverage: coverageReached(files), oxfmt: oxfmtFiles(files), oxlint: oxlintFiles() });
    expect(UNREACHED.unexempted(found)).toEqual([]);
  });

  test('every held TypeScript file is in a project, once in production, and no test is in production', () => {
    expect(UNPROJECTED.unexempted(projectProblems(typescriptFiles(), projectMembers()))).toEqual([]);
  });

  test('knip declares its scan set', () => {
    expect(tracked()).toContain('knip.json');
  });
});

describe('the scan-set checks', () => {
  test('a project holds the files under its own directory', () => {
    expect([projectDirectory('tsconfig.json'), projectDirectory('packages/foundation/tsconfig.test.json')]).toEqual(['', 'packages/foundation/']);
  });

  test('see a file a planted scan set misses', () => {
    expect(unreached(['a.ts', 'b.ts'], { oxfmt: new Set(['a.ts', 'b.ts']), oxlint: new Set(['a.ts']) })).toEqual(['b.ts: oxlint']);
  });

  test('see a file in no project, in two production projects, and a test in production', () => {
    const members = new Map([
      ['packages/foundation/tsconfig.json', new Set(['packages/foundation/src/a.ts', 'packages/foundation/src/a.test.ts', 'shared.ts'])],
      ['packages/systems/chat/tsconfig.json', new Set(['shared.ts'])],
      ['packages/foundation/tsconfig.test.json', new Set(['packages/foundation/src/a.ts', 'packages/foundation/src/b.test.ts'])],
    ]);
    expect(
      projectProblems(
        ['packages/foundation/src/a.ts', 'packages/foundation/src/a.test.ts', 'packages/foundation/src/b.test.ts', 'shared.ts', 'loose.ts'],
        members,
      ),
    ).toEqual([
      'packages/foundation/src/a.test.ts: a test in the production project packages/foundation/tsconfig.json',
      'shared.ts: in 2 production projects',
      'loose.ts: in no TypeScript project',
    ]);
  });
});
