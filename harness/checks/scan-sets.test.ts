/**
 * The file listing is over its floor, and every held TypeScript file is reached by every tool's scan set.
 *
 * The scan sets: oxlint's own file list (`oxlint --debug=files`); oxfmt's, read by planting every held
 * file unformatted in a copy of the checkout and listing what `oxfmt --list-different` would change;
 * the TypeScript projects of `harness/lib/projects.ts`, each listing its files (`tsc --listFilesOnly`):
 * every file is held by a project (listed by a project of its own holder, `Population.holderOf`, under
 * the project's directory, or at the root), by no more than one production project (a shipping member's `tsconfig.json`), and no test file by a production project;
 * Vitest's coverage `include` for every file that is not a test; jscpd's roots,
 * held by the clones check's own coverage of the listing; and knip's, each file matched by a `project`
 * or `entry` glob of the workspace holding it in the configuration knip loads.
 */

import { Accepted, Exemptions } from '#lint-rules/exemptions.ts';
import { FLOOR, ListingError, listing, tracked } from '#lib/source-files.ts';
import { coverageReached, testsOutsideCoverage } from './gate-config.ts';
import { describe, expect, test } from 'vitest';
import { heldByProject, knipFiles, knipWorkspace, oxfmtFiles, oxlintFiles, projectMembers } from './scan-sets.sets.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { population, typescriptFiles } from '#lib/scope.ts';
import type { Population } from '#lib/scope.ts';
import { Project } from '#lib/tools.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { tmpdir } from 'node:os';

const HARNESS_ID = 'scan-sets';

/** Held files a scan set leaves out while the gap is being closed, keyed by `<path>: <scan set>`. */
const UNREACHED = Exemptions.grouped({
  'adopting: the project lint-rules plugin runs inside oxlint; include harness/lint-rules in coverage and load its rules in-process from the lint-rules check':
    [
      'harness/lint-rules/ast.ts: coverage',
      'harness/lint-rules/closed.ts: coverage',
      'harness/lint-rules/jsx.ts: coverage',
      'harness/lint-rules/plugin.ts: coverage',
      'harness/lint-rules/rules/autofocus.ts: coverage',
      'harness/lint-rules/rules/closed-rules.ts: coverage',
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
      'harness/lint-rules/rules/own-keys.ts: coverage',
      'harness/lint-rules/rules/statics.ts: coverage',
      'harness/lint-rules/rules/store-owner.ts: coverage',
      'harness/lint-rules/rules/style-prop.ts: coverage',
      'harness/lint-rules/rules/sync-parts.ts: coverage',
      'harness/lint-rules/rules/total-reads.ts: coverage',
      'harness/lint-rules/rules/view-imports.ts: coverage',
      'harness/lint-rules/rules/vm-prop.ts: coverage',
    ],
  "adopting: the sandbox's Vite config, which no test imports; include it in the sandbox's coverage and import it from a settings check": [
    'experiences/sandbox/vite.config.ts: coverage',
  ],
  "knip enters them itself: its own config, and the vitest and oxlint plugins' configs, outside every project glob": [
    'knip.config.ts: knip',
    'oxlint.config.ts: knip',
    'vitest.gate.config.ts: knip',
  ],
  "the test runner leaves its own config file and its setup files out of coverage, whatever the include: Vitest's config resolution adds them to every coverage exclude":
    ['harness/lib/guards.ts: coverage', 'vitest.gate.config.ts: coverage'],
});

/** Project problems carried while the gap is being closed, keyed by the problem. */
const UNPROJECTED = new Exemptions({});

/**
 * The production projects: each shipping member's `tsconfig.json`.
 *
 * @param {Population} held - The population.
 * @returns {ReadonlySet<string>} The production project files.
 */
function productionProjects(held: Population): ReadonlySet<string> {
  return new Set(held.shipping.map((member) => `${member.dir}tsconfig.json`));
}

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

/** The planted modules the project check reads as tests. */
const TESTS = new Accepted(['packages/foundation/src/a.test.ts', 'packages/foundation/test/b.test.ts']);

/** The production projects, and which modules are tests or test support no production project may hold. */
interface Production {
  readonly projects: ReadonlySet<string>;
  readonly isTest: (path: string) => boolean;
}

/**
 * The problem of one file's projects: in none, in two production projects, or a test in a production project.
 *
 * @param {string} path - The file.
 * @param {readonly string[]} holding - The projects holding it.
 * @param {Production} production - The production projects, and which modules are tests.
 * @returns {readonly string[]} Its problem, if any.
 */
function fileProblems(path: string, holding: readonly string[], production: Readonly<Production>): readonly string[] {
  const inProduction = holding.filter((project) => production.projects.has(project));
  const [first] = inProduction;
  if (holding.length < ONE_PROJECT) {
    return [`${path}: in no TypeScript project`];
  }
  if (inProduction.length > ONE_PROJECT) {
    return [`${path}: in ${inProduction.length} production projects`];
  }
  return production.isTest(path) && first !== undefined ? [`${path}: a test in the production project ${first}`] : [];
}

/**
 * The project problems: a file in no project, in two production projects, or a test in a production project.
 *
 * @param {readonly string[]} files - The held files.
 * @param {ReadonlyMap<string, ReadonlySet<string>>} members - Each project's files, by project.
 * @param {Production} production - The production projects, and which modules are tests.
 * @returns {readonly string[]} One problem per file.
 */
function projectProblems(
  files: readonly string[],
  members: ReadonlyMap<string, ReadonlySet<string>>,
  production: Readonly<Production>,
): readonly string[] {
  const projectsOf: readonly (readonly [string, ReadonlySet<string>])[] = [...members];
  return files.flatMap((path) =>
    fileProblems(
      path,
      projectsOf.filter(([, set]) => set.has(path)).map(([project]) => project),
      production,
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
    const folder = await mkdtemp(`${tmpdir()}/unlisted-`);
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
  test('every held TypeScript file is reached by oxlint, oxfmt, knip and coverage', async () => {
    expect.hasAssertions();
    const files = await typescriptFiles();
    const [coverage, oxfmt, oxlint, knip] = await Promise.all([coverageReached(files), oxfmtFiles(files), oxlintFiles(), knipFiles(files)]);
    const found = unreached(files, { coverage, knip, oxfmt, oxlint });
    expect(UNREACHED.unexempted(found)).toStrictEqual([]);
  });

  test('every held TypeScript file is in a project, once in production, and no test is in production', async () => {
    expect.hasAssertions();
    const [files, members, held, isTest] = await Promise.all([typescriptFiles(), projectMembers(), population(), testsOutsideCoverage()]);
    const problems = projectProblems(files, members, { isTest, projects: productionProjects(held) });
    expect(UNPROJECTED.unexempted(problems)).toStrictEqual([]);
  });
});

describe("the reach check's reading of knip's configuration", () => {
  test("reads a knip workspace's globs under its directory, its production marks dropped", () => {
    expect.hasAssertions();
    expect(knipWorkspace('packages/core', { entry: ['src/main.ts!'], project: ['src/**/*.ts!', 'test/**/*.ts'] })).toStrictEqual({
      dir: 'packages/core/',
      globs: ['packages/core/src/**/*.ts', 'packages/core/test/**/*.ts', 'packages/core/src/main.ts'],
    });
  });

  test('refuses a negated knip glob, which knip and the reach check would read differently', () => {
    expect.hasAssertions();
    expect(() => knipWorkspace('packages/core', { project: ['src/**/*.ts!', '!src/generated/**'] })).toThrow(
      'packages/core: the reach check reads no negated knip glob, and the configuration holds !src/generated/**',
    );
  });
});

describe('the scan-set checks', () => {
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
        {
          isTest: (path) => TESTS.has(path),
          projects: new Set(['packages/foundation/tsconfig.json', 'packages/systems/chat/tsconfig.json']),
        },
      ),
    ).toStrictEqual([
      'packages/foundation/src/a.test.ts: a test in the production project packages/foundation/tsconfig.json',
      'shared.ts: in 2 production projects',
      'loose.ts: in no TypeScript project',
    ]);
  });
});

describe("the project check's holding", () => {
  test("a project holds the files it lists of its holder's under its directory, the harness's a root configuration module, and a test project none of its member's sources", async () => {
    expect.hasAssertions();
    const held = await plantedPopulation([], [['packages/core/', 'foundation']]);
    const listed = [
      'harness/lib/a.ts',
      'knip.config.ts',
      'packages/core/src/a.ts',
      'packages/core/test/a.test.ts',
      'node_modules/x/index.d.ts',
    ];
    expect(
      ['harness/tsconfig.json', 'packages/core/tsconfig.json', 'packages/core/test/tsconfig.json'].map((project) =>
        heldByProject(held, project, listed),
      ),
    ).toStrictEqual([
      new Set(['harness/lib/a.ts', 'knip.config.ts']),
      new Set(['packages/core/src/a.ts', 'packages/core/test/a.test.ts']),
      new Set(['packages/core/test/a.test.ts']),
    ]);
  });
});

describe('the production projects of a planted population', () => {
  test("a shipping member's project is a production project, a test-infrastructure member's is not", async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      [],
      [
        ['packages/core/', 'foundation'],
        ['packages/probe/', 'test-infrastructure'],
      ],
    );
    expect([...productionProjects(held)]).toStrictEqual(['packages/core/tsconfig.json']);
  });
});

export { HARNESS_ID };
