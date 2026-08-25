import { erase, parseTag } from '@narratives/foundation';
import { type FixtureInput, type FixtureRun, assertInvariant, runStream } from '@narratives/foundation/testing';
import { forwardOnlyTime } from '@narratives/system-chat/testing';
import fc from 'fast-check';
import { expect, test } from 'vitest';
import { parseTimeOfDay } from '../src/model/time';
import type { ChatMessageVM } from '../src/reduce';
import { chatSystem } from '../src/system';

interface StepOpts {
  readonly tags?: string[];
  readonly advanceDay?: boolean;
}
const story = (text: string, opts: StepOpts = {}): FixtureInput => ({
  input: {
    source: 'story',
    step: {
      text,
      tags: (opts.tags ?? []).map(parseTag),
      choices: [],
      externalCalls: opts.advanceDay ? [{ fn: 'advance_day' }] : [],
      status: 'continue',
    },
  },
});

const run = (inputs: FixtureInput[]): Promise<FixtureRun> =>
  runStream({ systems: [erase(chatSystem)], foreground: 'chat' }, inputs);
const times = (r: FixtureRun): (number | null)[] =>
  ((r.view('chat') as { messages: Record<string, readonly ChatMessageVM[]> }).messages.main ?? []).map((m) => m.time);
const H = (h: number, m = 0): number => h * 60 + m;
const MINUTES_PER_DAY = 1440;

test('parseTimeOfDay: AM/PM edges + 24h + malformed', () => {
  expect(parseTimeOfDay('12:00 AM')).toBe(0);
  expect(parseTimeOfDay('12:30 PM')).toBe(H(12, 30));
  expect(parseTimeOfDay('11:30 PM')).toBe(H(23, 30));
  expect(parseTimeOfDay('8:35 AM')).toBe(H(8, 35));
  expect(parseTimeOfDay('13:00')).toBe(H(13)); // 24h, no period
  expect(parseTimeOfDay('soon')).toBeNull();
  expect(parseTimeOfDay('13:00 PM')).toBeNull(); // AM/PM out of 1–12
  expect(parseTimeOfDay('9:99 AM')).toBeNull();
});

test('# time snaps forward; a backward snap is rejected (#1, #2)', async () => {
  const r = await run([
    story('a', { tags: ['time: 8:35 AM'] }), // establish
    story('b', { tags: ['time: 8:39 AM'] }), // forward
    story('c', { tags: ['time: 8:00 AM'] }), // backward → rejected, clock stays 8:39
  ]);
  expect(times(r)).toEqual([H(8, 35), H(8, 39), H(8, 39)]);
});

test('auto-drift +1 per message, only once anchored (#1, #3-adjacent)', async () => {
  const r = await run([
    story('a'), // before anchor → null
    story('b'), // still null
    story('c', { tags: ['time: 9:00 AM'] }), // anchors
    story('d'), // drift
    story('e'), // drift
  ]);
  expect(times(r)).toEqual([null, null, H(9), H(9) + 1, H(9) + 2]);
});

test('# duration:N jumps N minutes; malformed → drift (#1)', async () => {
  const r = await run([
    story('a', { tags: ['time: 9:00 AM'] }),
    story('b', { tags: ['duration: 30'] }),
    story('c', { tags: ['duration: nope'] }), // malformed → drift +1
  ]);
  expect(times(r)).toEqual([H(9), H(9) + 30, H(9) + 31]);
});

test('advance_day resets to next-day 09:00 first, then the message drifts (#1)', async () => {
  const r = await run([
    story('a', { tags: ['time: 10:00 PM'] }), // 22:00 day 0
    story('b', { advanceDay: true }), // → day1 09:00, then drift +1
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
    timeArb.map((t): FixtureInput => story('m', { tags: [`time: ${t}`] })),
    { maxLength: 10 },
  );
  await assertInvariant({ systems: [erase(chatSystem)], foreground: 'chat' }, streamArb, forwardOnlyTime);
});
