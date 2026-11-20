import * as fc from 'fast-check';
import type { DataRequest } from '../sim/effect';
import type { SystemId } from '../sim/snapshot';
import type { AnySystem } from '../sim/system';
import { type FixtureInput, type FixtureRun, runFixture } from './harness';
import { canonical } from './serialize';

// A rule violation found by an invariant predicate. `null` means the rule holds.
export interface Violation {
  readonly rule: string;
  readonly detail: string;
  readonly at?: number;
}

// An invariant: a pure check over a completed run's observable stream. The chat
// predicates (task-018) are of this shape; tasks 020–026 assert them green.
/** @public */
export type Predicate = (run: FixtureRun) => Violation | null;

// A story with no authored content: the pump can advance it at most to `end`, so a
// generated `Story(InkStep)` stream never interleaves with authored ink lines.
const ENDED_STORY = '-> END';

/** @public */
export interface StreamOptions {
  readonly systems: readonly AnySystem[];
  readonly foreground?: SystemId;
  readonly seed?: number;
  readonly fetch?: (request: DataRequest) => unknown;
}

// Drive a generated input stream through the REAL runtime over the ended story.
export function runStream(opts: StreamOptions, inputs: readonly FixtureInput[]): Promise<FixtureRun> {
  return runFixture({
    story: ENDED_STORY,
    systems: opts.systems,
    inputs,
    ...(opts.foreground !== undefined ? { foreground: opts.foreground } : {}),
    ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
    ...(opts.fetch !== undefined ? { fetch: opts.fetch } : {}),
  });
}

/**
 * The outcome of a property run. A test asserts on it (`expect(report.failed, report.message)`), so
 * a property is an assertion of the test that runs it, and a shrunk counterexample is its message.
 *
 * @public
 */
export interface PropertyReport {
  readonly failed: boolean;
  readonly message: string;
}

function report(details: fc.RunDetails<[FixtureInput[]]>): PropertyReport {
  return { failed: details.failed, message: fc.defaultReportMessage(details) ?? 'the property held' };
}

/**
 * The standing determinism guard (testing-strategy.md): the same input stream, replayed, yields a
 * byte-identical canonical trace. Generators feeding this exclude data-request steps (a fetch
 * resumes through a microtask, so its order depends on scheduling).
 */
export async function checkDeterministic(
  opts: StreamOptions,
  streamArb: fc.Arbitrary<FixtureInput[]>,
  runs = 30,
): Promise<PropertyReport> {
  const details = await fc.check(
    fc.asyncProperty(streamArb, async (inputs) => {
      const first = await runStream(opts, inputs);
      const second = await runStream(opts, inputs);
      return canonical(first.trace) === canonical(second.trace);
    }),
    { numRuns: runs },
  );
  return report(details);
}

/** Check that a predicate holds over every generated stream, shrinking a failure to its smallest. */
export async function checkInvariant(
  opts: StreamOptions,
  streamArb: fc.Arbitrary<FixtureInput[]>,
  predicate: Predicate,
  runs = 50,
): Promise<PropertyReport> {
  const details = await fc.check(
    fc.asyncProperty(streamArb, async (inputs) => {
      const violation = predicate(await runStream(opts, inputs));
      if (violation !== null) {
        const at = violation.at === undefined ? '' : ` @${violation.at}`;
        throw new Error(`${violation.rule}: ${violation.detail}${at}`);
      }
      return true;
    }),
    { numRuns: runs },
  );
  return report(details);
}
