import { erase } from '@narratives/foundation';
import { type FixtureInput, type FixtureRun, checkInvariant } from '@narratives/foundation/testing';
import { forwardOnlyTime } from '@narratives/system-chat/testing';
import * as fc from 'fast-check';
import { expect, test } from 'vitest';
import { chatSystem } from '../src/system';
import { run, story } from './support';

const times = (r: FixtureRun): (number | null)[] =>
  (r.viewOf(chatSystem).messages['main'] ?? []).map((m) => m.time);
const H = (h: number, m = 0): number => h * 60 + m;
const MINUTES_PER_DAY = 1440;

test.each([
  ['12:00 AM', 0],
  ['12:30 PM', H(12, 30)],
  ['11:30 PM', H(23, 30)],
  ['8:35 AM', H(8, 35)],
  ['13:00', H(13)], // 24h, no period
  ['soon', null],
  ['13:00 PM', null], // AM/PM out of 1–12
  ['9:99 AM', null],
])('a first # time: %s anchors the clock at %s (null: unparseable, stays unanchored)', async (raw, expected) => {
  const r = await run([story('m', [`time: ${raw}`])]);
  expect(times(r)).toEqual([expected]);
});

test('# time snaps forward; a backward snap is rejected (#1, #2)', async () => {
  const r = await run([
    story('a', ['time: 8:35 AM']), // establish
    story('b', ['time: 8:39 AM']), // forward
    story('c', ['time: 8:00 AM']), // backward → rejected, clock stays 8:39
  ]);
  expect(times(r)).toEqual([H(8, 35), H(8, 39), H(8, 39)]);
});

test('auto-drift +1 per message, only once anchored (#1, #3-adjacent)', async () => {
  const r = await run([
    story('a'), // before anchor → null
    story('b'), // still null
    story('c', ['time: 9:00 AM']), // anchors
    story('d'), // drift
    story('e'), // drift
  ]);
  expect(times(r)).toEqual([null, null, H(9), H(9) + 1, H(9) + 2]);
});

test('# duration:N jumps N minutes; malformed → drift (#1)', async () => {
  const r = await run([
    story('a', ['time: 9:00 AM']),
    story('b', ['duration: 30']),
    story('c', ['duration: nope']), // malformed → drift +1
  ]);
  expect(times(r)).toEqual([H(9), H(9) + 30, H(9) + 31]);
});

test('advance_day resets to next-day 09:00 first, then the message drifts (#1)', async () => {
  const r = await run([
    story('a', ['time: 10:00 PM']), // 22:00 day 0
    story('b', [], { advanceDay: true }), // → day1 09:00, then drift +1
  ]);
  expect(times(r)).toEqual([H(22), MINUTES_PER_DAY + H(9) + 1]);
  const t = times(r);
  expect((t[1] ?? 0) > (t[0] ?? 0)).toBe(true); // forward across the day boundary
});

test('forwardOnlyTime holds over generated time-tag streams (#4, #5)', async () => {
  // mixes parseable snaps (establish / forward / backward-reject) with unparseable
  // (→ drift), so the clock is anchored and the invariant is non-vacuous.
  const timeArb = fc.constantFrom('7:00 AM', '9:15 AM', '11:30 PM', '2:45 PM', 'nope');
  const streamArb = fc.array(
    timeArb.map((t): FixtureInput => story('m', [`time: ${t}`])),
    { maxLength: 10 },
  );
  const result = await checkInvariant({ systems: [erase(chatSystem)], foreground: 'chat' }, streamArb, forwardOnlyTime);
  expect(result.failed, result.message).toBe(false);
});
