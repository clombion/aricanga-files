import type { FixtureInput, FixtureRun } from './harness';
import { asyncProperty, check, defaultReportMessage } from 'fast-check';
import type { AnySystem } from '#src/sim/system';
import type { Arbitrary } from 'fast-check';
import type { DataRequest } from '#src/sim/effect';
import type { SystemId } from '#src/sim/snapshot';
import { canonical } from './serialize';
import { runFixture } from './harness';

/** A rule violation found by an invariant predicate. */
interface Violation {
  readonly rule: string;
  readonly detail: string;
  readonly at?: number;
}

/**
 * An invariant: a pure check over a completed run's observable stream, giving the
 * violation it found or `undefined` when the rule holds. The chat predicates are of
 * this shape; each physics slice asserts its own green.
 *
 * @public
 */
type Predicate = (run: FixtureRun) => Violation | undefined;

/*
 * A story with no authored content: the pump can advance it at most to `end`, so a
 * generated `Story(InkStep)` stream never interleaves with authored ink lines.
 */
const ENDED_STORY = '-> END';

/** How many generated streams a determinism check replays unless told otherwise. */
const DETERMINISM_RUNS = 30;

/** How many generated streams an invariant check runs unless told otherwise. */
const INVARIANT_RUNS = 50;

/** @public */
interface StreamOptions {
  /** How many generated streams a property check runs. */
  readonly runs?: number;
  readonly systems: readonly Readonly<AnySystem>[];
  readonly foreground?: SystemId;
  readonly seed?: number;
  readonly fetch?: (request: DataRequest) => unknown;
}

/**
 * The outcome of a property run. A test asserts on it (`expect(report.failed, report.message)`), so
 * a property is an assertion of the test that runs it, and a shrunk counterexample is its message.
 *
 * @public
 */
interface PropertyReport {
  readonly failed: boolean;
  readonly message: string;
}

/**
 * Drive a generated input stream through the REAL runtime over the ended story.
 *
 * @param {StreamOptions} opts - The systems and the run's settings.
 * @param {readonly FixtureInput[]} inputs - The stream.
 * @returns {Promise<FixtureRun>} What the run observed.
 */
async function runStream(opts: Readonly<StreamOptions>, inputs: readonly FixtureInput[]): Promise<FixtureRun> {
  const run = await runFixture({
    inputs,
    story: ENDED_STORY,
    systems: opts.systems,
    ...(opts.foreground === undefined ? {} : { foreground: opts.foreground }),
    ...(opts.seed === undefined ? {} : { seed: opts.seed }),
    ...(opts.fetch === undefined ? {} : { fetch: opts.fetch }),
  });
  return run;
}

/**
 * The report of a fast-check run.
 *
 * @param {boolean} failed - Whether the property failed.
 * @param {string | undefined} message - fast-check's report of the failure, if it failed.
 * @returns {PropertyReport} Whether it failed, and its message.
 */
function report(failed: boolean, message: string | undefined): PropertyReport {
  return { failed, message: message ?? 'the property held' };
}

/**
 * The standing determinism guard (testing-strategy.md): the same input stream, replayed, yields a
 * byte-identical canonical trace.
 *
 * @param {StreamOptions} opts - The systems and the run's settings.
 * @param {Arbitrary} streamArb - The generator of input streams.
 * @returns {Promise<PropertyReport>} The property's outcome.
 */
async function checkDeterministic(
  opts: Readonly<StreamOptions>,
  streamArb: Readonly<Arbitrary<FixtureInput[]>>,
): Promise<PropertyReport> {
  const details = await check(
    asyncProperty(streamArb, async (inputs: readonly FixtureInput[]) => {
      const first = await runStream(opts, inputs);
      const second = await runStream(opts, inputs);
      return canonical(first.trace) === canonical(second.trace);
    }),
    { numRuns: opts.runs ?? DETERMINISM_RUNS },
  );
  return report(details.failed, defaultReportMessage(details));
}

/**
 * Check that a predicate holds over every generated stream, shrinking a failure to its smallest.
 *
 * @param {StreamOptions} opts - The systems and the run's settings.
 * @param {Arbitrary} streamArb - The generator of input streams.
 * @param {Predicate} predicate - The invariant.
 * @returns {Promise<PropertyReport>} The property's outcome.
 */
async function checkInvariant(
  opts: Readonly<StreamOptions>,
  streamArb: Readonly<Arbitrary<FixtureInput[]>>,
  predicate: Predicate,
): Promise<PropertyReport> {
  const details = await check(
    asyncProperty(streamArb, async (inputs: readonly FixtureInput[]) => {
      const violation = predicate(await runStream(opts, inputs));
      if (violation !== undefined) {
        const at = violation.at === undefined ? '' : ` @${violation.at}`;
        throw new Error(`${violation.rule}: ${violation.detail}${at}`);
      }
      return true;
    }),
    { numRuns: opts.runs ?? INVARIANT_RUNS },
  );
  return report(details.failed, defaultReportMessage(details));
}

export { checkDeterministic, checkInvariant, runStream };
export type { Predicate, PropertyReport, StreamOptions, Violation };
