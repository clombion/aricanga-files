/**
 * The one coverage floor, held on all four metrics: statements, branches, functions and lines.
 *
 * The gate's `test` task runs Vitest with coverage, which writes Istanbul's JSON report (coverage-final.json)
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
const FLOOR = 100;

/** Where the gate's coverage run writes its reports. */
export const COVERAGE_DIR: string = join(tmpdir(), 'aricanga-coverage');

const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;
type Metric = (typeof METRICS)[number];

/** One file's coverage: how many items of each metric it has, and how many the run reached. */
export interface FileCoverage {
  readonly path: string;
  readonly total: Readonly<Record<Metric, number>>;
  readonly covered: Readonly<Record<Metric, number>>;
}

function counts(value: unknown, what: string): readonly number[] {
  return Object.values(object(value, what)).flatMap((entry) =>
    Array.isArray(entry) ? entry.map(Number) : [Number(entry)],
  );
}

/** The covered lines of a file: a line is covered when any statement starting on it ran. */
function lines(statementMap: unknown, statements: unknown): { readonly total: number; readonly covered: number } {
  const locations = object(statementMap, 'statementMap');
  const byLine = new Map<number, number>();
  for (const [id, count] of Object.entries(object(statements, 'statements'))) {
    const line = Number(object(object(locations[id], `statement ${id}`)['start'], 'start')['line']);
    byLine.set(line, Math.max(byLine.get(line) ?? 0, Number(count)));
  }
  const values = [...byLine.values()];
  return { total: values.length, covered: values.filter((count) => count > 0).length };
}

function reached(values: readonly number[]): number {
  return values.filter((count) => count > 0).length;
}

/** The coverage of every file of a parsed Istanbul JSON report, relative to `root`. */
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
const ADOPTING =
  'adopting: the shortfall this file carried when the floor was adopted; close it with tests and lower the entry';

export const DEBT: CountedExemptions = new CountedExemptions({
  'experiences/sandbox/src/main.ts :: branches': [6, ADOPTING],
  'experiences/sandbox/src/main.ts :: functions': [3, ADOPTING],
  'experiences/sandbox/src/main.ts :: lines': [4, ADOPTING],
  'experiences/sandbox/src/main.ts :: statements': [5, ADOPTING],
  'harness/lib/checks.ts :: branches': [8, ADOPTING],
  'harness/lib/checks.ts :: functions': [6, ADOPTING],
  'harness/lib/checks.ts :: lines': [8, ADOPTING],
  'harness/lib/checks.ts :: statements': [8, ADOPTING],
  'harness/lib/config.ts :: branches': [4, ADOPTING],
  'harness/lib/config.ts :: lines': [2, ADOPTING],
  'harness/lib/config.ts :: statements': [2, ADOPTING],
  'harness/lib/docs.ts :: branches': [16, ADOPTING],
  'harness/lib/docs.ts :: functions': [4, ADOPTING],
  'harness/lib/docs.ts :: lines': [14, ADOPTING],
  'harness/lib/docs.ts :: statements': [15, ADOPTING],
  'harness/lib/exemptions.ts :: branches': [4, ADOPTING],
  'harness/lib/exemptions.ts :: functions': [2, ADOPTING],
  'harness/lib/exemptions.ts :: lines': [4, ADOPTING],
  'harness/lib/exemptions.ts :: statements': [6, ADOPTING],
  'harness/lib/generated.ts :: branches': [2, ADOPTING],
  'harness/lib/generated.ts :: functions': [6, ADOPTING],
  'harness/lib/generated.ts :: lines': [8, ADOPTING],
  'harness/lib/generated.ts :: statements': [9, ADOPTING],
  'harness/lib/lint-rules.ts :: branches': [4, ADOPTING],
  'harness/lib/lint-rules.ts :: lines': [3, ADOPTING],
  'harness/lib/lint-rules.ts :: statements': [3, ADOPTING],
  'harness/lib/process.ts :: branches': [7, ADOPTING],
  'harness/lib/process.ts :: lines': [5, ADOPTING],
  'harness/lib/process.ts :: statements': [5, ADOPTING],
  'harness/lib/tools.ts :: branches': [1, ADOPTING],
  'harness/lib/tools.ts :: lines': [2, ADOPTING],
  'harness/lib/tools.ts :: statements': [2, ADOPTING],
  'harness/lib/ts-source.ts :: branches': [4, ADOPTING],
  'harness/lib/ts-source.ts :: lines': [2, ADOPTING],
  'harness/lib/ts-source.ts :: statements': [2, ADOPTING],
  'harness/scripts/check-pushed.ts :: branches': [4, ADOPTING],
  'harness/scripts/check-pushed.ts :: functions': [2, ADOPTING],
  'harness/scripts/check-pushed.ts :: lines': [6, ADOPTING],
  'harness/scripts/check-pushed.ts :: statements': [7, ADOPTING],
  'harness/scripts/coverage-floor.ts :: lines': [1, ADOPTING],
  'harness/scripts/coverage-floor.ts :: statements': [1, ADOPTING],
  'harness/scripts/dupes.ts :: lines': [1, ADOPTING],
  'harness/scripts/dupes.ts :: statements': [1, ADOPTING],
  'harness/scripts/gen-docs.ts :: branches': [2, ADOPTING],
  'harness/scripts/gen-docs.ts :: lines': [4, ADOPTING],
  'harness/scripts/gen-docs.ts :: statements': [4, ADOPTING],
  'harness/scripts/typecheck.ts :: branches': [4, ADOPTING],
  'harness/scripts/typecheck.ts :: lines': [8, ADOPTING],
  'harness/scripts/typecheck.ts :: statements': [8, ADOPTING],
  'packages/foundation/src/core/create-experience.ts :: functions': [4, ADOPTING],
  'packages/foundation/src/core/create-experience.ts :: lines': [4, ADOPTING],
  'packages/foundation/src/core/create-experience.ts :: statements': [4, ADOPTING],
  'packages/foundation/src/host/runtime.ts :: branches': [12, ADOPTING],
  'packages/foundation/src/host/runtime.ts :: lines': [11, ADOPTING],
  'packages/foundation/src/host/runtime.ts :: statements': [14, ADOPTING],
  'packages/foundation/src/ink/ink-runtime.ts :: branches': [18, ADOPTING],
  'packages/foundation/src/ink/ink-runtime.ts :: functions': [10, ADOPTING],
  'packages/foundation/src/ink/ink-runtime.ts :: lines': [11, ADOPTING],
  'packages/foundation/src/ink/ink-runtime.ts :: statements': [18, ADOPTING],
  'packages/foundation/src/services/event-bus.ts :: branches': [4, ADOPTING],
  'packages/foundation/src/services/event-bus.ts :: functions': [4, ADOPTING],
  'packages/foundation/src/services/event-bus.ts :: lines': [12, ADOPTING],
  'packages/foundation/src/services/event-bus.ts :: statements': [14, ADOPTING],
  'packages/foundation/src/sim/effect.ts :: branches': [8, ADOPTING],
  'packages/foundation/src/sim/effect.ts :: lines': [5, ADOPTING],
  'packages/foundation/src/sim/effect.ts :: statements': [7, ADOPTING],
  'packages/foundation/src/sim/exhaustive.ts :: functions': [1, ADOPTING],
  'packages/foundation/src/sim/exhaustive.ts :: lines': [1, ADOPTING],
  'packages/foundation/src/sim/exhaustive.ts :: statements': [1, ADOPTING],
  'packages/foundation/src/sim/router.ts :: branches': [1, ADOPTING],
  'packages/foundation/src/sim/router.ts :: lines': [1, ADOPTING],
  'packages/foundation/src/sim/router.ts :: statements': [1, ADOPTING],
  'packages/foundation/src/sim/system.ts :: branches': [1, ADOPTING],
  'packages/foundation/src/sim/system.ts :: lines': [1, ADOPTING],
  'packages/foundation/src/sim/system.ts :: statements': [1, ADOPTING],
  'packages/foundation/src/testing/fixture-system.ts :: branches': [6, ADOPTING],
  'packages/foundation/src/testing/fixture-system.ts :: lines': [5, ADOPTING],
  'packages/foundation/src/testing/fixture-system.ts :: statements': [5, ADOPTING],
  'packages/foundation/src/testing/generators.ts :: branches': [2, ADOPTING],
  'packages/foundation/src/testing/harness.ts :: branches': [3, ADOPTING],
  'packages/foundation/src/testing/harness.ts :: functions': [2, ADOPTING],
  'packages/foundation/src/testing/harness.ts :: lines': [1, ADOPTING],
  'packages/foundation/src/testing/harness.ts :: statements': [2, ADOPTING],
  'packages/foundation/src/testing/property.ts :: branches': [5, ADOPTING],
  'packages/foundation/src/testing/property.ts :: lines': [2, ADOPTING],
  'packages/foundation/src/testing/property.ts :: statements': [2, ADOPTING],
  'packages/systems/cards/src/system.ts :: branches': [5, ADOPTING],
  'packages/systems/cards/src/system.ts :: functions': [1, ADOPTING],
  'packages/systems/cards/src/system.ts :: lines': [1, ADOPTING],
  'packages/systems/cards/src/system.ts :: statements': [3, ADOPTING],
  'packages/systems/chat/src/effects.ts :: branches': [4, ADOPTING],
  'packages/systems/chat/src/effects.ts :: functions': [1, ADOPTING],
  'packages/systems/chat/src/effects.ts :: lines': [1, ADOPTING],
  'packages/systems/chat/src/effects.ts :: statements': [1, ADOPTING],
  'packages/systems/chat/src/model/defer.ts :: branches': [2, ADOPTING],
  'packages/systems/chat/src/model/read-state.ts :: branches': [1, ADOPTING],
  'packages/systems/chat/src/model/time.ts :: branches': [1, ADOPTING],
  'packages/systems/chat/src/system.ts :: branches': [2, ADOPTING],
  'packages/systems/chat/src/system.ts :: lines': [1, ADOPTING],
  'packages/systems/chat/src/system.ts :: statements': [2, ADOPTING],
  'packages/systems/chat/src/testing/predicates.ts :: branches': [24, ADOPTING],
  'packages/systems/chat/src/testing/predicates.ts :: functions': [4, ADOPTING],
  'packages/systems/chat/src/testing/predicates.ts :: lines': [24, ADOPTING],
  'packages/systems/chat/src/testing/predicates.ts :: statements': [26, ADOPTING],
});

/** The floor's problems: every file and metric whose shortfall differs from its debt. */
export function floorProblems(files: readonly FileCoverage[], debt: CountedExemptions): readonly string[] {
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

/** Hold the floor, with `debt`, on the coverage report in `directory`; write each problem and return the exit status. */
export function main(err: (text: string) => void, debt: CountedExemptions, directory: string): number {
  const problems = floorProblems(fileCoverage(gateReport(directory)), debt);
  for (const problem of problems) {
    err(`${problem}\n`);
  }
  return problems.length === 0 ? 0 : 1;
}
