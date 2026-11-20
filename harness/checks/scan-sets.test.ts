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

import { FLOOR, ListingError, listing, tracked } from '#lib/source-files.ts';
import { coverageReached, isTestFile, oxfmtFiles, oxlintFiles, projectDirectory, projectMembers } from './scan-sets.sets.ts';
import { describe, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { Exemptions } from '#lib/exemptions.ts';
import { Project } from '#lib/tools.ts';
import { join } from 'node:path/posix';
import { tmpdir } from 'node:os';
import { typescriptFiles } from '#lib/scope.ts';

const HARNESS_ID = 'scan-sets';

/** Held files a scan set leaves out while the gap is being closed, keyed by `<path>: <scan set>`. */
const UNREACHED = Exemptions.grouped({
  'adopting: configuration modules no test imports; include them in coverage and import them from the settings checks': [
    'experiences/sandbox/vite.config.ts: coverage',
    'vitest.gate.config.ts: coverage',
  ],
  'adopting: the project lint-rules plugin runs inside oxlint; include harness/lint-rules in coverage and load its rules in-process from the lint-rules check':
    [
      'harness/lint-rules/ast.ts: coverage',
      'harness/lint-rules/jsx.ts: coverage',
      'harness/lint-rules/plugin.ts: coverage',
      'harness/lint-rules/rules/autofocus.ts: coverage',
      'harness/lint-rules/rules/controlled.ts: coverage',
      'harness/lint-rules/rules/env.ts: coverage',
      'harness/lint-rules/rules/flags.ts: coverage',
      'harness/lint-rules/rules/imports.ts: coverage',
      'harness/lint-rules/rules/json.ts: coverage',
      'harness/lint-rules/rules/jsx-rules.ts: coverage',
      'harness/lint-rules/rules/labels.ts: coverage',
      'harness/lint-rules/rules/legacy.ts: coverage',
      'harness/lint-rules/rules/mechanics.ts: coverage',
      'harness/lint-rules/rules/mirrors.ts: coverage',
      'harness/lint-rules/rules/module-rules.ts: coverage',
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

const PRODUCTION_PROJECT = /^(?:packages\/(?:foundation|systems\/[^/]+)|experiences\/[^/]+)\/tsconfig\.json$/u;
/** A file in more than this many production projects is held twice. */
const ONE_PROJECT = 1;

/**
 * Each held file with the scan sets that miss it, as `<path>: <scan set>`.
 *
 * @param {readonly string[]} files - The held files.
 * @param {Readonly<Record<string, ReadonlySet<string>>>} sets - Each scan's set of files, by scan.
 * @returns {readonly string[]} One entry per file and scan set that misses it.
 */
function unreached(files: readonly string[], sets: Readonly<Record<string, ReadonlySet<string>>>): readonly string[] {
  const named: readonly (readonly [string, ReadonlySet<string>])[] = Object.entries(sets);
  return files.flatMap((path) => named.filter(([, reached]) => !reached.has(path)).map(([name]) => `${path}: ${name}`));
}

/**
 * The problem of one file's projects: in none, in two production projects, or a test in a production project.
 *
 * @param {string} path - The file.
 * @param {readonly string[]} holding - The projects holding it.
 * @returns {readonly string[]} Its problem, if any.
 */
function fileProblems(path: string, holding: readonly string[]): readonly string[] {
  const production = holding.filter((project) => PRODUCTION_PROJECT.test(project));
  const [first] = production;
  if (holding.length < ONE_PROJECT) {
    return [`${path}: in no TypeScript project`];
  }
  if (production.length > ONE_PROJECT) {
    return [`${path}: in ${production.length} production projects`];
  }
  return isTestFile(path) && first !== undefined ? [`${path}: a test in the production project ${first}`] : [];
}

/**
 * The project problems: a file in no project, in two production projects, or a test in a production project.
 *
 * @param {readonly string[]} files - The held files.
 * @param {ReadonlyMap<string, ReadonlySet<string>>} members - Each project's files, by project.
 * @returns {readonly string[]} One problem per file.
 */
function projectProblems(files: readonly string[], members: ReadonlyMap<string, ReadonlySet<string>>): readonly string[] {
  const projectsOf: readonly (readonly [string, ReadonlySet<string>])[] = [...members];
  return files.flatMap((path) =>
    fileProblems(
      path,
      projectsOf.filter(([, set]) => set.has(path)).map(([project]) => project),
    ),
  );
}

describe('the listing', () => {
  test('is over its floor', async () => {
    expect.hasAssertions();
    const listed = await tracked();
    expect(listed.length).toBeGreaterThanOrEqual(FLOOR);
  });

  test('refuses a short listing instead of scanning nothing', async () => {
    expect.hasAssertions();
    await expect(listing('', tmpdir())).rejects.toThrow(ListingError);
  });

  test('refuses a folder git cannot list', async () => {
    expect.hasAssertions();
    const folder = await mkdtemp(join(tmpdir(), 'unlisted-'));
    try {
      await expect(tracked(folder)).rejects.toThrow(ListingError);
    } finally {
      await rm(folder, { force: true, recursive: true });
    }
  });

  test('keeps existing files only', async () => {
    expect.hasAssertions();
    const project = await Project.create({ linkModules: false });
    try {
      const names = Array.from({ length: FLOOR }, (_value, index) => `f${index}.ts`);
      await project.writeAll(names.map((name) => [name, ''] as const));
      await expect(listing([...names, 'deleted.ts', ''].join('\0'), project.root)).resolves.toStrictEqual(names.toSorted());
    } finally {
      await project.remove();
    }
  });
});

describe('the repository', () => {
  test('every held TypeScript file is reached by oxlint, oxfmt and coverage', async () => {
    expect.hasAssertions();
    const files = await typescriptFiles();
    const [coverage, oxfmt, oxlint] = await Promise.all([coverageReached(files), oxfmtFiles(files), oxlintFiles()]);
    const found = unreached(files, { coverage, oxfmt, oxlint });
    expect(UNREACHED.unexempted(found)).toStrictEqual([]);
  });

  test('every held TypeScript file is in a project, once in production, and no test is in production', async () => {
    expect.hasAssertions();
    const [files, members] = await Promise.all([typescriptFiles(), projectMembers()]);
    const problems = projectProblems(files, members);
    expect(UNPROJECTED.unexempted(problems)).toStrictEqual([]);
  });

  test('knip declares its scan set', async () => {
    expect.hasAssertions();
    await expect(tracked()).resolves.toContain('knip.json');
  });
});

describe('the scan-set checks', () => {
  test('a project holds the files under its own directory', () => {
    expect.hasAssertions();
    expect([projectDirectory('tsconfig.json'), projectDirectory('packages/foundation/test/tsconfig.json')]).toStrictEqual([
      '',
      'packages/foundation/test/',
    ]);
  });

  test('see a file a planted scan set misses', () => {
    expect.hasAssertions();
    expect(unreached(['a.ts', 'b.ts'], { oxfmt: new Set(['a.ts', 'b.ts']), oxlint: new Set(['a.ts']) })).toStrictEqual(['b.ts: oxlint']);
  });

  test('see a file in no project, in two production projects, and a test in production', () => {
    expect.hasAssertions();
    const members = new Map([
      ['packages/foundation/tsconfig.json', new Set(['packages/foundation/src/a.ts', 'packages/foundation/src/a.test.ts', 'shared.ts'])],
      ['packages/systems/chat/tsconfig.json', new Set(['shared.ts'])],
      ['packages/foundation/test/tsconfig.json', new Set(['packages/foundation/src/a.ts', 'packages/foundation/test/b.test.ts'])],
    ]);
    expect(
      projectProblems(
        [
          'packages/foundation/src/a.ts',
          'packages/foundation/src/a.test.ts',
          'packages/foundation/test/b.test.ts',
          'shared.ts',
          'loose.ts',
        ],
        members,
      ),
    ).toStrictEqual([
      'packages/foundation/src/a.test.ts: a test in the production project packages/foundation/tsconfig.json',
      'shared.ts: in 2 production projects',
      'loose.ts: in no TypeScript project',
    ]);
  });
});

export { HARNESS_ID };
