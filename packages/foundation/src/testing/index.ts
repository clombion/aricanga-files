/*
 * `@narratives/foundation/testing` — the kernel test harness. Drives any
 * system over an ink fixture through the real runtime, captures the reduce trace
 * via the runtime's observer port, and serializes a canonical golden. Imports no
 * concrete system; reusable by chat and cards tests.
 */

export { FIXTURE_TAG, fixtureSystem, fixtureSystemErased, gatedFields, gatedSystem } from './fixture-system';
export type { FixtureCommand, FixtureState } from './fixture-system';
export { inkStepArb, storyInputArb, storyStreamArb, tagArb } from './generators';
export type { StepGenOptions } from './generators';
export { compileInk, runFixture } from './harness';
export type { FixtureInput, FixtureOptions, FixtureRun } from './harness';
export { checkDeterministic, checkInvariant, runStream } from './property';
export type { Predicate, PropertyReport, StreamOptions, Violation } from './property';
export { canonical } from './serialize';
