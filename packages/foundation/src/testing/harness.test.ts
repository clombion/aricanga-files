import { expect, test } from 'vitest';
import type { Command, Input } from '../sim/input';
import { FIXTURE_TAG, fixtureSystemErased } from './fixture-system';
import { runFixture } from './harness';
import { canonical } from './serialize';

const player = (kind: string, payload: unknown = undefined): { input: Input<unknown, Command>; target: string } => ({
  input: { source: 'player', command: { kind, payload } },
  target: 'fixture',
});

test('runFixture captures the full multi-family stream headlessly (#1, #2, #4)', async () => {
  const run = await runFixture({
    story: `Start # ${FIXTURE_TAG}: 1\n`,
    systems: [fixtureSystemErased],
    fetch: () => 'VALUE',
    inputs: [player('present'), player('fetch'), player('persist'), player('schedule')],
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
  expect((run.view('fixture') as { fetched: unknown }).fetched).toBe('VALUE');
  expect((run.view('fixture') as { busy: boolean }).busy).toBe(false);
});

test('same fixture + same seed ⇒ identical trace (#3)', async () => {
  const opts = {
    story: `Start # ${FIXTURE_TAG}: 1\n`,
    systems: [fixtureSystemErased],
    fetch: () => 'VALUE',
    inputs: [player('schedule'), player('fetch')],
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
    story,
    systems: [fixtureSystemErased],
    inputs: [player('choose', { index: 0 })],
  });

  // the post-choice line was reached only because DriveInk(choose) advanced ink
  expect((run.view('fixture') as { lines: string[] }).lines).toContain('Resolved');
});

test('golden tripwire: the canonical stream matches the recorded golden (#6)', async () => {
  const run = await runFixture({
    story: `Start # ${FIXTURE_TAG}: 1\n`,
    systems: [fixtureSystemErased],
    fetch: () => 'VALUE',
    inputs: [player('present'), player('schedule')],
  });
  // A reducer change that alters the observable stream fails this diff.
  await expect(canonical(run.trace)).toMatchFileSnapshot('./__goldens__/fixture-stream.json');
});
