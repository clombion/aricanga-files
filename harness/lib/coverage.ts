/**
 * The one coverage floor, held on all four metrics: statements, branches, functions and lines.
 *
 * The gate's `test` task runs Vitest with coverage, which writes Istanbul's JSON report (coverage-final.json)
 * under `COVERAGE_DIR` (outside the checkout); `harness/scripts/coverage-floor.ts` then reads it.
 * Every item the run did not reach is a shortfall keyed by `site(file, metric)`. `DEBT` is the
 * shortfall the project carries while it adopts the floor: a file whose shortfall differs from its
 * entry either way fails, so new gaps fail and a closed gap forces its entry down.
 */

import { CountedExemptions, site } from './exemptions.ts';
import { EXIT_FAILURE, EXIT_SUCCESS } from './output.ts';
import { json, object } from './config.ts';
import type { Mismatch } from './exemptions.ts';
import { REPO_ROOT } from './paths.ts';
import { isEmpty } from './lists.ts';
import path from 'node:path';
import { relativeTo } from './relative.ts';
import { textAt } from './source-files.ts';
import { tmpdir } from 'node:os';

/** One file's coverage: how many items of each metric it has, and how many the run reached. */
interface FileCoverage {
  readonly path: string;
  readonly total: Readonly<Record<Metric, number>>;
  readonly covered: Readonly<Record<Metric, number>>;
}

/** A count of items and how many of them the run reached. */
interface Reach {
  readonly total: number;
  readonly covered: number;
}

/** The floor, in percent, of every metric. */
const FLOOR = 100;

/** The whole, in percent. */
const WHOLE = 100;

/** The hit count of an item no test reached. */
const UNREACHED = 0;

/** Where the gate's coverage run writes its reports. */
const COVERAGE_DIR: string = path.join(tmpdir(), 'aricanga-coverage');

const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;

/** A coverage metric. */
type Metric = (typeof METRICS)[number];

/**
 * The hit counts of one metric of a file.
 *
 * @param {unknown} value - The report's map of hit counts (a branch's entry is a list).
 * @param {string} what - The metric, for a refusal.
 * @returns {readonly number[]} The hit counts.
 */
function counts(value: unknown, what: string): readonly number[] {
  return Object.values(object(value, what)).flatMap((entry) => (Array.isArray(entry) ? entry.map(Number) : [Number(entry)]));
}

/**
 * How many of a metric's items the run reached.
 *
 * @param {readonly number[]} values - The items' hit counts.
 * @returns {number} The items hit at least once.
 */
function reached(values: readonly number[]): number {
  return values.filter((count) => count > UNREACHED).length;
}

/**
 * The covered lines of a file: a line is covered when any statement starting on it ran.
 *
 * @param {unknown} statementMap - The report's statement locations.
 * @param {unknown} statements - The report's statement hit counts.
 * @returns {Reach} The lines, and how many were covered.
 */
function lines(statementMap: unknown, statements: unknown): Reach {
  const locations = object(statementMap, 'statementMap');
  const byLine = new Map<number, number>();
  for (const [id, count] of Object.entries(object(statements, 'statements'))) {
    const line = Number(object(object(locations[id], `statement ${id}`)['start'], 'start')['line']);
    byLine.set(line, Math.max(byLine.get(line) ?? UNREACHED, Number(count)));
  }
  const values = [...byLine.values()];
  return { covered: reached(values), total: values.length };
}

/**
 * One file's coverage.
 *
 * @param {string} file - The file's path in the report.
 * @param {unknown} entry - Its entry in the report.
 * @param {string} root - The root paths are made relative to.
 * @returns {FileCoverage} Its coverage.
 */
function coverageOf(file: string, entry: unknown, root: string): FileCoverage {
  const fields = object(entry, file);
  const statements = counts(fields['s'], 'statements');
  const branches = counts(fields['b'], 'branches');
  const functions = counts(fields['f'], 'functions');
  const lineCounts = lines(fields['statementMap'], fields['s']);
  return {
    covered: { branches: reached(branches), functions: reached(functions), lines: lineCounts.covered, statements: reached(statements) },
    path: relativeTo(root, file),
    total: { branches: branches.length, functions: functions.length, lines: lineCounts.total, statements: statements.length },
  };
}

/**
 * The coverage of every file of a parsed Istanbul JSON report.
 *
 * @param {unknown} report - The parsed report.
 * @param {string} root - The root paths are made relative to.
 * @returns {readonly FileCoverage[]} Each file's coverage, sorted by path.
 */
function fileCoverage(report: unknown, root: string = REPO_ROOT): readonly FileCoverage[] {
  return Object.entries(object(report, 'coverage report'))
    .map(([file, entry]: readonly [string, unknown]) => coverageOf(file, entry, root))
    .toSorted((first, second) => first.path.localeCompare(second.path));
}

/**
 * The items under the floor, one key per item, as `site(file, metric)`.
 *
 * @param {readonly FileCoverage[]} files - The files' coverage.
 * @param {number} floor - The floor, in percent.
 * @returns {readonly string[]} A key per missing item.
 */
function shortfalls(files: readonly FileCoverage[], floor: number = FLOOR): readonly string[] {
  return files.flatMap((file) =>
    METRICS.flatMap((metric) => {
      const needed = Math.ceil((file.total[metric] * floor) / WHOLE);
      const short = Math.max(UNREACHED, needed - file.covered[metric]);
      return Array.from({ length: short }, () => site(file.path, metric));
    }),
  );
}

/** The shortfall the project carries while it adopts the floor, per file and metric. */
const ADOPTING = 'adopting: the shortfall this file carried when the floor was adopted; close it with tests and lower the entry';

const DEBT: CountedExemptions = new CountedExemptions({
  'harness/lib/checks.ts :: branches': { count: 8, reason: ADOPTING },
  'harness/lib/checks.ts :: functions': { count: 6, reason: ADOPTING },
  'harness/lib/checks.ts :: lines': { count: 8, reason: ADOPTING },
  'harness/lib/checks.ts :: statements': { count: 8, reason: ADOPTING },
  'harness/lib/config.ts :: branches': { count: 4, reason: ADOPTING },
  'harness/lib/config.ts :: lines': { count: 2, reason: ADOPTING },
  'harness/lib/config.ts :: statements': { count: 2, reason: ADOPTING },
  'harness/lib/docs.ts :: branches': { count: 16, reason: ADOPTING },
  'harness/lib/docs.ts :: functions': { count: 4, reason: ADOPTING },
  'harness/lib/docs.ts :: lines': { count: 14, reason: ADOPTING },
  'harness/lib/docs.ts :: statements': { count: 15, reason: ADOPTING },
  'harness/lib/exemptions.ts :: branches': { count: 4, reason: ADOPTING },
  'harness/lib/exemptions.ts :: functions': { count: 2, reason: ADOPTING },
  'harness/lib/exemptions.ts :: lines': { count: 4, reason: ADOPTING },
  'harness/lib/exemptions.ts :: statements': { count: 6, reason: ADOPTING },
  'harness/lib/generated.ts :: branches': { count: 2, reason: ADOPTING },
  'harness/lib/generated.ts :: functions': { count: 6, reason: ADOPTING },
  'harness/lib/generated.ts :: lines': { count: 8, reason: ADOPTING },
  'harness/lib/generated.ts :: statements': { count: 9, reason: ADOPTING },
  'harness/lib/lint-rules.ts :: branches': { count: 4, reason: ADOPTING },
  'harness/lib/lint-rules.ts :: lines': { count: 3, reason: ADOPTING },
  'harness/lib/lint-rules.ts :: statements': { count: 3, reason: ADOPTING },
  'harness/lib/process.ts :: branches': { count: 7, reason: ADOPTING },
  'harness/lib/process.ts :: lines': { count: 5, reason: ADOPTING },
  'harness/lib/process.ts :: statements': { count: 5, reason: ADOPTING },
  'harness/lib/tools.ts :: branches': { count: 1, reason: ADOPTING },
  'harness/lib/tools.ts :: lines': { count: 2, reason: ADOPTING },
  'harness/lib/tools.ts :: statements': { count: 2, reason: ADOPTING },
  'harness/lib/ts-source.ts :: branches': { count: 4, reason: ADOPTING },
  'harness/lib/ts-source.ts :: lines': { count: 2, reason: ADOPTING },
  'harness/lib/ts-source.ts :: statements': { count: 2, reason: ADOPTING },
  'harness/scripts/check-pushed.ts :: branches': { count: 4, reason: ADOPTING },
  'harness/scripts/check-pushed.ts :: functions': { count: 2, reason: ADOPTING },
  'harness/scripts/check-pushed.ts :: lines': { count: 6, reason: ADOPTING },
  'harness/scripts/check-pushed.ts :: statements': { count: 7, reason: ADOPTING },
  'harness/scripts/coverage-floor.ts :: lines': { count: 1, reason: ADOPTING },
  'harness/scripts/coverage-floor.ts :: statements': { count: 1, reason: ADOPTING },
  'harness/scripts/dupes.ts :: lines': { count: 1, reason: ADOPTING },
  'harness/scripts/dupes.ts :: statements': { count: 1, reason: ADOPTING },
  'harness/scripts/gen-docs.ts :: branches': { count: 2, reason: ADOPTING },
  'harness/scripts/gen-docs.ts :: lines': { count: 4, reason: ADOPTING },
  'harness/scripts/gen-docs.ts :: statements': { count: 4, reason: ADOPTING },
  'harness/scripts/typecheck.ts :: branches': { count: 4, reason: ADOPTING },
  'harness/scripts/typecheck.ts :: lines': { count: 8, reason: ADOPTING },
  'harness/scripts/typecheck.ts :: statements': { count: 8, reason: ADOPTING },
});

/**
 * The floor's problems: every file and metric whose shortfall differs from its debt.
 *
 * @param {readonly FileCoverage[]} files - The files' coverage.
 * @param {Readonly<CountedExemptions>} debt - The shortfall the project carries.
 * @returns {readonly string[]} The problems.
 */
function floorProblems(files: readonly FileCoverage[], debt: Readonly<CountedExemptions>): readonly string[] {
  return debt
    .mismatches(shortfalls(files))
    .map((mismatch: Mismatch) =>
      mismatch.found > mismatch.registered
        ? `${mismatch.key}: ${mismatch.found} items under the ${FLOOR} % floor, ${mismatch.registered} registered`
        : `${mismatch.key}: ${mismatch.found} items under the floor, but ${mismatch.registered} registered: lower the debt`,
    );
}

/**
 * The gate's coverage report, parsed.
 *
 * @param {string} directory - Where the run wrote its reports.
 * @returns {Promise<unknown>} The parsed report.
 */
async function gateReport(directory: string = COVERAGE_DIR): Promise<unknown> {
  const text = await textAt(path.join(directory, 'coverage-final.json'));
  return json(text);
}

/**
 * Hold the floor, with `debt`, on the coverage report in `directory`, writing each problem.
 *
 * @param {(text: string) => void} err - Where problems are written.
 * @param {Readonly<CountedExemptions>} debt - The shortfall the project carries.
 * @param {string} directory - Where the run wrote its reports.
 * @returns {Promise<number>} The exit status.
 */
async function main(err: (text: string) => void, debt: Readonly<CountedExemptions>, directory: string): Promise<number> {
  const report = await gateReport(directory);
  const problems = floorProblems(fileCoverage(report), debt);
  for (const problem of problems) {
    err(`${problem}\n`);
  }
  return isEmpty(problems) ? EXIT_SUCCESS : EXIT_FAILURE;
}

export { COVERAGE_DIR, DEBT, fileCoverage, floorProblems, gateReport, main, shortfalls };
export type { FileCoverage };
