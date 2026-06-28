// @narratives/foundation/testing — the kernel test harness (task-017). Drives any
// system over an ink fixture through the real runtime, captures the reduce trace
// via the runtime's observer port, and serializes a canonical golden. Imports no
// concrete system; reusable by chat and cards tests.

export { runFixture, compileInk } from './harness';
export type { FixtureOptions, FixtureInput, FixtureRun } from './harness';
export { canonical } from './serialize';
export { tagArb, inkStepArb, storyInputArb, storyStreamArb } from './generators';
export type { StepGenOptions } from './generators';
export { runStream, assertDeterministic, assertInvariant } from './property';
export type { Violation, Predicate, StreamOptions } from './property';
export {
  fixtureSystem,
  fixtureSystemErased,
  FIXTURE_TAG,
} from './fixture-system';
export type { FixtureState, FixtureCommand } from './fixture-system';
