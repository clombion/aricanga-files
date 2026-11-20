/**
 * The one coverage floor, held on all four metrics: statements, branches, functions and lines.
 *
 * The gate's `test` task runs Vitest with coverage, which writes Istanbul's `coverage-final.json`
 * under `COVERAGE_DIR` (outside the checkout); `harness/scripts/coverage-floor.ts` then reads it.
 * Every item the run did not reach is a shortfall keyed by `site(file, metric)`. `DEBT` is the
 * shortfall the project carries while it adopts the floor: a file whose shortfall differs from its
 * entry either way fails, so new gaps fail and a closed gap forces its entry down.
 */

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { json, object } from './config.ts';
import { CountedExemptions, type Mismatch, site } from './exemptions.ts';
import { REPO_ROOT } from './paths.ts';
import { relativeTo } from './relative.ts';

/** The floor, in percent, of every metric. */
export const FLOOR = 100;

/** Where the gate's coverage run writes its reports. */
export const COVERAGE_DIR: string = join(tmpdir(), 'aricanga-coverage');

export const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;
export type Metric = (typeof METRICS)[number];

/** One file's coverage: how many items of each metric it has, and how many the run reached. */
export interface FileCoverage {
  readonly path: string;
  readonly total: Readonly<Record<Metric, number>>;
  readonly covered: Readonly<Record<Metric, number>>;
}

function counts(value: unknown, what: string): readonly number[] {
  return Object.values(object(value ?? {}, what)).flatMap((entry) =>
    Array.isArray(entry) ? entry.map(Number) : [Number(entry)],
  );
}

/** The covered lines of a file: a line is covered when any statement starting on it ran. */
function lines(statementMap: unknown, statements: unknown): { readonly total: number; readonly covered: number } {
  const hits = object(statements ?? {}, 'statements');
  const byLine = new Map<number, number>();
  for (const [id, location] of Object.entries(object(statementMap ?? {}, 'statementMap'))) {
    const line = Number(object(object(location, 'location')['start'], 'start')['line']);
    byLine.set(line, Math.max(byLine.get(line) ?? 0, Number(hits[id] ?? 0)));
  }
  const values = [...byLine.values()];
  return { total: values.length, covered: values.filter((count) => count > 0).length };
}

function reached(values: readonly number[]): number {
  return values.filter((count) => count > 0).length;
}

/** The coverage of every file of a parsed `coverage-final.json`, relative to `root`. */
export function fileCoverage(report: unknown, root: string = REPO_ROOT): readonly FileCoverage[] {
  return Object.entries(object(report, 'coverage report'))
    .map(([file, entry]) => {
      const fields = object(entry, file);
      const statements = counts(fields['s'], 'statements');
      const branches = counts(fields['b'], 'branches');
      const functions = counts(fields['f'], 'functions');
      const lineCounts = lines(fields['statementMap'], fields['s']);
      return {
        path: relativeTo(root, file),
        total: { statements: statements.length, branches: branches.length, functions: functions.length, lines: lineCounts.total },
        covered: {
          statements: reached(statements),
          branches: reached(branches),
          functions: reached(functions),
          lines: lineCounts.covered,
        },
      };
    })
    .toSorted((a, b) => a.path.localeCompare(b.path));
}

/** The items under the floor, one key per item, as `site(file, metric)`. */
export function shortfalls(files: readonly FileCoverage[], floor: number = FLOOR): readonly string[] {
  return files.flatMap((file) =>
    METRICS.flatMap((metric) => {
      const needed = Math.ceil((file.total[metric] * floor) / 100);
      const short = Math.max(0, needed - file.covered[metric]);
      return Array.from({ length: short }, () => site(file.path, metric));
    }),
  );
}

/** The shortfall the project carries while it adopts the floor, per file and metric. */
export const DEBT: CountedExemptions = new CountedExemptions({});

/** The floor's problems: every file and metric whose shortfall differs from its debt. */
export function floorProblems(files: readonly FileCoverage[], debt: CountedExemptions = DEBT): readonly string[] {
  return debt.mismatches(shortfalls(files)).map((mismatch: Mismatch) =>
    mismatch.found > mismatch.registered
      ? `${mismatch.key}: ${mismatch.found} items under the ${FLOOR} % floor, ${mismatch.registered} registered`
      : `${mismatch.key}: ${mismatch.found} items under the floor, but ${mismatch.registered} registered: lower the debt`,
  );
}

/** The gate's coverage report, parsed. */
export function gateReport(directory: string = COVERAGE_DIR): unknown {
  return json(readFileSync(join(directory, 'coverage-final.json'), 'utf8'));
}

/** Hold the floor on the coverage report in `directory`; write each problem and return the exit status. */
export function main(err: (text: string) => void, directory: string = COVERAGE_DIR): number {
  const problems = floorProblems(fileCoverage(gateReport(directory)));
  for (const problem of problems) {
    err(`${problem}\n`);
  }
  return problems.length === 0 ? 0 : 1;
}
