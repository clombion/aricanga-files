import fc from 'fast-check';
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
export type Predicate = (run: FixtureRun) => Violation | null;

// A story with no authored content: the pump can advance it at most to `end`, so a
// generated `Story(InkStep)` stream never interleaves with authored ink lines.
const ENDED_STORY = '-> END';

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

// The standing determinism guard (testing-strategy.md): the same input stream,
// replayed, yields a byte-identical canonical trace. Generators feeding this must
// exclude data-request steps (fetch resumes via microtask — scheduling-ordered).
export async function assertDeterministic(
  opts: StreamOptions,
  streamArb: fc.Arbitrary<FixtureInput[]>,
  runs = 30,
): Promise<void> {
  await fc.assert(
    fc.asyncProperty(streamArb, async (inputs) => {
      const a = await runStream(opts, inputs);
      const b = await runStream(opts, inputs);
      return canonical(a.trace) === canonical(b.trace);
    }),
    { numRuns: runs },
  );
}

/** Assert a predicate holds over every generated stream (shrinks on failure). */
export async function assertInvariant(
  opts: StreamOptions,
  streamArb: fc.Arbitrary<FixtureInput[]>,
  predicate: Predicate,
  runs = 50,
): Promise<void> {
  await fc.assert(
    fc.asyncProperty(streamArb, async (inputs) => {
      const violation = predicate(await runStream(opts, inputs));
      if (violation) throw new Error(`${violation.rule}: ${violation.detail}${violation.at !== undefined ? ` @${violation.at}` : ''}`);
      return true;
    }),
    { numRuns: runs },
  );
}
