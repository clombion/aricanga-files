import { FIXTURE_TAG, fixtureSystem, fixtureSystemErased } from '#src/testing/fixture-system';
import { describe, expect, test } from 'vitest';
import type { FixtureCommand } from '#src/testing/fixture-system';
import type { Input } from '#src/sim/input';
import { canonical } from '#src/testing/serialize';
import { setTimeout as nextTask } from 'node:timers/promises';
import { runFixture } from '#src/testing/harness';

/** The data the fixture's responder answers every fetch with. */
const FETCHED = 'VALUE';

/** A timer that fires on the next macrotask. */
const NEXT_TASK = 0;

/** The story line the fixture system claims. */
const START = `Start # ${FIXTURE_TAG}: 1\n`;

/** A story that offers two choices, each leading to the line `Resolved`. */
const CHOICE = [
  `Pick one # ${FIXTURE_TAG}: 1`,
  '+ [Left] -> done',
  '+ [Right] -> done',
  '=== done ===',
  `Resolved # ${FIXTURE_TAG}: 2`,
  '-> END',
].join('\n');

/**
 * A player command to the fixture system.
 *
 * @param {string} kind - The command's kind.
 * @param {unknown} [payload] - Its payload.
 * @returns {object} The input, addressed to the fixture system.
 */
function player(kind: FixtureCommand['kind'], payload?: unknown): { readonly input: Input<unknown>; readonly target: string } {
  return { input: { command: { kind, payload }, source: 'player' }, target: 'fixture' };
}

/**
 * The fixture's data responder.
 *
 * @returns {string} The fetched data.
 */
function respond(): string {
  return FETCHED;
}

/**
 * A responder whose data arrives a macrotask later, as data from a real source would.
 *
 * @returns {Promise<string>} The fetched data, once it arrives.
 */
async function respondLater(): Promise<string> {
  await nextTask(NEXT_TASK);
  return FETCHED;
}

describe('the fixture harness drain', () => {
  test('waits for a fetch whose data arrives later before the run is read', async () => {
    expect.hasAssertions();
    const run = await runFixture({ fetch: respondLater, inputs: [player('fetch')], story: START, systems: [fixtureSystemErased] });
    expect(run.viewOf(fixtureSystem).fetched).toBe(FETCHED);
  });
});

describe('the fixture harness', () => {
  test('runFixture captures the full multi-family stream headlessly (#1, #2, #4)', async () => {
    expect.hasAssertions();
    const run = await runFixture({
      fetch: respond,
      inputs: [player('present'), player('fetch'), player('persist'), player('schedule')],
      story: START,
      systems: [fixtureSystemErased],
    });

    // The trace is the correlated reduce stream, not just one effect family.
    expect(run.trace).not.toStrictEqual([]);
    expect(run.trace.every((record) => record.systemId === 'fixture')).toBe(true);
    expect([...new Set(run.effects.map((effect) => effect.family))].toSorted()).toStrictEqual(['fetch', 'persist', 'present', 'schedule']);
    // Suspending effects settled deterministically via the drain.
    expect(run.viewOf(fixtureSystem)).toMatchObject({ busy: false, fetched: FETCHED });
  });

  test('same fixture + same seed ⇒ identical trace (#3)', async () => {
    expect.hasAssertions();
    const opts = { fetch: respond, inputs: [player('schedule'), player('fetch')], story: START, systems: [fixtureSystemErased] };
    const first = await runFixture(opts);
    const second = await runFixture(opts);
    expect(canonical(first.trace)).toBe(canonical(second.trace));
  });

  test('a choose-command drives an ink choice via DriveInk (#4)', async () => {
    expect.hasAssertions();
    const run = await runFixture({ inputs: [player('choose', { index: 0 })], story: CHOICE, systems: [fixtureSystemErased] });
    // The post-choice line was reached only because DriveInk(choose) advanced ink.
    expect(run.viewOf(fixtureSystem).lines).toContain('Resolved');
  });

  test('golden tripwire: the canonical stream matches the recorded golden (#6)', async () => {
    expect.hasAssertions();
    const run = await runFixture({
      fetch: respond,
      inputs: [player('present'), player('schedule')],
      story: START,
      systems: [fixtureSystemErased],
    });
    // A reducer change that alters the observable stream fails this diff.
    await expect(canonical(run.trace)).toMatchFileSnapshot('./__goldens__/fixture-stream.json');
  });
});

describe('the canonical text', () => {
  test('orders integer-like keys first, ascending, and the others by code unit, whatever order they were written in', () => {
    expect.hasAssertions();
    const written = Object.fromEntries([
      ['bb', 'b'],
      ['aa', 'a'],
      ['10', 'ten'],
      ['9', 'nine'],
    ]);
    expect(canonical(written)).toBe('{\n  "9": "nine",\n  "10": "ten",\n  "aa": "a",\n  "bb": "b"\n}');
  });

  test('orders keys by code unit, whatever order they were written in', () => {
    expect.hasAssertions();
    const written: readonly (readonly [string, string])[] = [
      ['bb', 'b'],
      ['BB', 'B'],
      ['aa', 'a'],
    ];
    const ordered = '{\n  "BB": "B",\n  "aa": "a",\n  "bb": "b"\n}';
    const reversed: Readonly<Record<string, string>> = Object.fromEntries(written.toReversed());
    expect([canonical(Object.fromEntries(written)), canonical(reversed)]).toStrictEqual([ordered, ordered]);
  });
});
