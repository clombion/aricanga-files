import { expect, test } from 'vitest';
import type { Input } from '#src/sim/input';
import { FIXTURE_TAG, fixtureSystem, fixtureSystemErased } from './fixture-system';
import type { FixtureCommand } from './fixture-system';
import { runFixture } from './harness';
import { canonical } from './serialize';

const player = (kind: FixtureCommand['kind'], payload?: unknown): { input: Input<unknown>; target: string } => ({
  input: { command: { kind, payload }, source: 'player' },
  target: 'fixture',
});

test('runFixture captures the full multi-family stream headlessly (#1, #2, #4)', async () => {
  const run = await runFixture({
    fetch: () => 'VALUE',
    inputs: [player('present'), player('fetch'), player('persist'), player('schedule')],
    story: `Start # ${FIXTURE_TAG}: 1\n`,
    systems: [fixtureSystemErased],
  });

  // The trace is the correlated reduce stream, not just one effect family.
  expect(run.trace.length).toBeGreaterThan(0);
  expect(run.trace.every((r) => r.systemId === 'fixture')).toBe(true);

  const families = new Set(run.effects.map((e) => e.family));
  expect(families).toContain('present');
  expect(families).toContain('fetch');
  expect(families).toContain('persist');
  expect(families).toContain('schedule');

  // suspending effects settled deterministically via the drain
  expect(run.viewOf(fixtureSystem).fetched).toBe('VALUE');
  expect(run.viewOf(fixtureSystem).busy).toBe(false);
});

test('same fixture + same seed ⇒ identical trace (#3)', async () => {
  const opts = {
    fetch: () => 'VALUE',
    inputs: [player('schedule'), player('fetch')],
    story: `Start # ${FIXTURE_TAG}: 1\n`,
    systems: [fixtureSystemErased],
  };
  const a = await runFixture(opts);
  const b = await runFixture(opts);
  expect(canonical(a.trace)).toBe(canonical(b.trace));
});

test('a choose-command drives an ink choice via DriveInk (#4)', async () => {
  const story = [
    `Pick one # ${FIXTURE_TAG}: 1`,
    '+ [Left] -> done',
    '+ [Right] -> done',
    '=== done ===',
    `Resolved # ${FIXTURE_TAG}: 2`,
    '-> END',
  ].join('\n');

  const run = await runFixture({
    inputs: [player('choose', { index: 0 })],
    story,
    systems: [fixtureSystemErased],
  });

  // the post-choice line was reached only because DriveInk(choose) advanced ink
  expect(run.viewOf(fixtureSystem).lines).toContain('Resolved');
});

test('golden tripwire: the canonical stream matches the recorded golden (#6)', async () => {
  const run = await runFixture({
    fetch: () => 'VALUE',
    inputs: [player('present'), player('schedule')],
    story: `Start # ${FIXTURE_TAG}: 1\n`,
    systems: [fixtureSystemErased],
  });
  // A reducer change that alters the observable stream fails this diff.
  await expect(canonical(run.trace)).toMatchFileSnapshot('./__goldens__/fixture-stream.json');
});
