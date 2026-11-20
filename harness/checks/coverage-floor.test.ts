/**
 * The coverage floor fails an untaken branch, an uncalled function and an unrun line, on all four metrics, and its debt fails both ways.
 *
 * The plants run Vitest with v8 coverage in a planted project and read the Istanbul report the way
 * `harness/scripts/coverage-floor.ts` reads the gate's: every line and branch taken passes; a
 * dropped case or an uncalled function is a shortfall of its file and metric; a registered debt
 * passes its exact shortfall and fails once the gap closes or grows. The gate's config writes the
 * report the script reads.
 */

import { COVERAGE_DIR, DEBT, fileCoverage, floorProblems, gateReport, main, shortfalls } from '#lib/coverage.ts';
import { CountedExemptions, site } from '#lib/exemptions.ts';
import { EXIT_CLEAN, EXIT_FINDINGS } from './exit-status.ts';
import { describe, expect, test } from 'vitest';
import type { FileCoverage } from '#lib/coverage.ts';
import { Project } from '#lib/tools.ts';
import { gateCoverage } from './gate-config.ts';
import { join } from 'node:path/posix';
import { tracked } from '#lib/source-files.ts';

const HARNESS_ID = 'coverage-floor';

const BRANCHY = "export function sign(value: number): string {\n  if (value < 0) {\n    return 'negative';\n  }\n  return 'positive';\n}\n";
const UNCALLED = "export function used(): number {\n  return 1;\n}\nexport function unused(): number {\n  return 2;\n}\n";
const CONFIG = `export default {
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', reportsDirectory: 'coverage', reporter: ['json'], include: ['src/**'] },
  },
};
`;
const FULL = `import { expect, test } from 'vitest';
import { sign } from '../src/branchy';
import { unused, used } from '../src/uncalled';
test('all', () => {
  expect([sign(-1), sign(1), used(), unused()]).toStrictEqual(['negative', 'positive', 1, 2]);
});
`;

/**
 * The coverage of a planted project whose test is `tests`.
 *
 * @param {string} tests - The tests.
 * @returns {Promise<readonly FileCoverage[]>} The coverage of a planted project whose test is `tests`.
 */
async function planted(tests: string): Promise<readonly FileCoverage[]> {
  const project = await Project.create();
  try {
    await Promise.all([
      project.write('vitest.config.ts', CONFIG),
      project.write('src/branchy.ts', BRANCHY),
      project.write('src/uncalled.ts', UNCALLED),
      project.write('tests/plant.test.ts', tests),
    ]);
    const done = await project.tool('vitest', 'run', '--coverage');
    expect(done.status, done.stdout + done.stderr).toBe(EXIT_CLEAN);
    const report = await gateReport(join(project.root, 'coverage'));
    return fileCoverage(report, project.root);
  } finally {
    await project.remove();
  }
}

const NONE = new CountedExemptions({});
/** Lower floors, as a percentage of a file's items. */
const HALF_FLOOR = 50;
const THREE_QUARTER_FLOOR = 75;
/** The problems the script writes for the planted shortfall: its statements and its lines. */
const PLANTED_PROBLEMS = 2;
/** The debt the debt tests register. */
const DEBT_OF_A = new CountedExemptions(
  {
    [site('src/a.ts', 'lines')]: { count: 1, reason: 'planted' },
    [site('src/a.ts', 'statements')]: { count: 2, reason: 'planted' },
  },
);

/**
 * The file a debt key names.
 *
 * @param {string} key - A `site(path, metric)` key.
 * @returns {string} Its path.
 */
function fileOf(key: string): string {
  const [path = key] = key.split(' :: ');
  return path;
}

/**
 * The script's exit status and output on a report written into a fresh folder.
 *
 * @param {(root: string) => unknown} report - The report, from the folder's path.
 * @returns {Promise<readonly [number, readonly string[]]>} The exit status and each problem written.
 */
async function runScript(report: (root: string) => unknown): Promise<readonly [number, readonly string[]]> {
  const project = await Project.create({ linkModules: false });
  try {
    await project.write('coverage-final.json', JSON.stringify(report(project.root)));
    const errors: string[] = [];
    const status = await main((text) => {
      errors.push(text);
    }, NONE, project.root);
    return [status, errors];
  } finally {
    await project.remove();
  }
}

/**
 * An Istanbul report of one file with one unrun statement; its keys are the format's (`s`, `b`, `f`).
 *
 * @param {string} root - The folder the report's file sits in.
 * @returns {unknown} The report.
 */
function unrunStatement(root: string): unknown {
  const entry = Object.fromEntries([
    ['b', {}],
    ['f', {}],
    ['s', { '0': 0 }],
    ['statementMap', { '0': { start: { line: 1 } } }],
  ]);
  return { [join(root, 'src/a.ts')]: entry };
}

/**
 * The files a debt names that the listing does not hold.
 *
 * @param {CountedExemptions} debt - The debt.
 * @returns {Promise<readonly string[]>} The files a debt names that the listing does not hold.
 */
async function unlisted(debt: CountedExemptions): Promise<readonly string[]> {
  const files = new Set(await tracked());
  return [...debt.entries.keys()].map((key) => fileOf(key)).filter((path) => !files.has(path));
}

describe('the floor', () => {
  test('passes every line, branch and function taken', async () => {
    expect.hasAssertions();
    const files = await planted(FULL);
    expect(files.map((file) => file.path)).toStrictEqual(['src/branchy.ts', 'src/uncalled.ts']);
    expect(floorProblems(files, NONE)).toStrictEqual([]);
  });

  test('fails an untaken branch on its statements, branches and lines', async () => {
    expect.hasAssertions();
    const files = await planted(FULL.replace('sign(-1), ', '').replace("'negative', ", ''));
    expect(floorProblems(files, NONE)).toStrictEqual([
      'src/branchy.ts :: branches: 1 items under the 100 % floor, 0 registered',
      'src/branchy.ts :: lines: 1 items under the 100 % floor, 0 registered',
      'src/branchy.ts :: statements: 1 items under the 100 % floor, 0 registered',
    ]);
  });

  test('fails an uncalled function on its functions, statements and lines', async () => {
    expect.hasAssertions();
    const files = await planted(FULL.replace(', unused()]', ']').replace(', 2]', ']'));
    expect(floorProblems(files, NONE)).toStrictEqual([
      'src/uncalled.ts :: functions: 1 items under the 100 % floor, 0 registered',
      'src/uncalled.ts :: lines: 1 items under the 100 % floor, 0 registered',
      'src/uncalled.ts :: statements: 1 items under the 100 % floor, 0 registered',
    ]);
  });
});

describe('the debt', () => {
  const file: FileCoverage = {
    covered: { branches: 2, functions: 1, lines: 3, statements: 2 },
    path: 'src/a.ts',
    total: { branches: 2, functions: 1, lines: 4, statements: 4 },
  };

  test('passes its exact shortfall', () => {
    expect.hasAssertions();
    expect(floorProblems([file], DEBT_OF_A)).toStrictEqual([]);
  });

  test('fails once the gap closes, and once it grows', () => {
    expect.hasAssertions();
    const closed = { ...file, covered: { ...file.covered, statements: 3 } };
    expect(floorProblems([closed], DEBT_OF_A)).toStrictEqual([
      'src/a.ts :: statements: 1 items under the floor, but 2 registered: lower the debt',
    ]);
    const grown = { ...file, covered: { ...file.covered, branches: 1 } };
    expect(floorProblems([grown], DEBT_OF_A)).toStrictEqual(['src/a.ts :: branches: 1 items under the 100 % floor, 0 registered']);
  });

  test('a lower floor is a fraction of the items', () => {
    expect.hasAssertions();
    expect(shortfalls([file], HALF_FLOOR)).toStrictEqual([]);
    expect(shortfalls([file], THREE_QUARTER_FLOOR)).toStrictEqual([site('src/a.ts', 'statements')]);
  });

  test('names only files the listing holds', async () => {
    expect.hasAssertions();
    await expect(unlisted(DEBT)).resolves.toStrictEqual([]);
  });
});

describe('the gate', () => {
  test('writes the Istanbul JSON report the script reads, outside the checkout', async () => {
    expect.hasAssertions();
    const coverage = await gateCoverage();
    expect(coverage['reportsDirectory']).toBe(COVERAGE_DIR);
    expect(coverage['reporter']).toContain('json');
  });

  test('the script exits 0 on a report with no shortfall', async () => {
    expect.hasAssertions();
    await expect(runScript(() => ({}))).resolves.toStrictEqual([EXIT_CLEAN, []]);
  });

  test('the script exits 1 on a report with a shortfall and writes each problem', async () => {
    expect.hasAssertions();
    const [status, errors] = await runScript(unrunStatement);
    expect([status, errors.length]).toStrictEqual([EXIT_FINDINGS, PLANTED_PROBLEMS]);
  });
});

export { HARNESS_ID };
