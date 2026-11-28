import { array, constantFrom } from 'fast-check';
import { describe, test } from 'vitest';
import { messagesOf, run, story } from '#test/support';
import type { ChatRun } from '#test/support';
import type { FixtureInput } from '@narratives/foundation/testing';
import { chatSystem } from '#src/system';
import { checkInvariant } from '@narratives/foundation/testing';
import { erase } from '@narratives/foundation';
import { forwardOnlyTime } from '@narratives/system-chat/testing';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
/** An anchored clock drifts one minute per message without a time or duration tag. */
const DRIFT = 1;
/** The minutes a `# duration:` tag jumps the clock by. */
const JUMP = 30;
/** The longest generated stream of time-tagged messages. */
const MAX_STREAM = 10;

/**
 * The minute of the day a 24-hour `HH:MM` time names, read independently of the parser under test.
 *
 * @param {string} time - The time, such as `08:35`.
 * @returns {number} Its minute of the day.
 */
function minutesAt(time: string): number {
  const [hours = '', minutes = ''] = time.split(':');
  return Number(hours) * MINUTES_PER_HOUR + Number(minutes);
}

/**
 * The times of the default chat's messages after a run.
 *
 * @param {ChatRun} result - The completed run.
 * @returns {readonly (number | undefined)[]} Each message's time, undefined while the clock was unanchored.
 */
function times(result: ChatRun): readonly (number | undefined)[] {
  return messagesOf(result, 'main').map((message) => message.time);
}

describe('the first # time: tag', () => {
  test.for([
    ['12:00 AM', minutesAt('00:00')],
    ['12:30 PM', minutesAt('12:30')],
    ['11:30 PM', minutesAt('23:30')],
    ['8:35 AM', minutesAt('08:35')],
    // A 24-hour time, with no period.
    ['13:00', minutesAt('13:00')],
    ['soon', undefined],
    // AM and PM take an hour from 1 to 12.
    ['13:00 PM', undefined],
    ['9:99 AM', undefined],
  ] as const)('%s anchors the clock at %s (undefined: unparseable, stays unanchored)', async ([raw, expected], { expect }) => {
    expect.hasAssertions();
    const result = await run([story('m', [`time: ${raw}`])]);
    expect(times(result)).toStrictEqual([expected]);
  });
});

describe('the clock', () => {
  test('# time snaps forward; a backward snap is rejected (#1, #2)', async ({ expect }) => {
    expect.hasAssertions();
    const result = await run([
      // Establishes the anchor.
      story('a', ['time: 8:35 AM']),
      // Moves forward.
      story('b', ['time: 8:39 AM']),
      // Backward: rejected, the clock stays at 8:39.
      story('c', ['time: 8:00 AM']),
    ]);
    expect(times(result)).toStrictEqual([minutesAt('08:35'), minutesAt('08:39'), minutesAt('08:39')]);
  });

  test('drifts a minute per message, only once anchored (#1, #3-adjacent)', async ({ expect }) => {
    expect.hasAssertions();
    const nine = minutesAt('09:00');
    const result = await run([story('a'), story('b'), story('c', ['time: 9:00 AM']), story('d'), story('e')]);
    expect(times(result)).toStrictEqual([undefined, undefined, nine, nine + DRIFT, nine + DRIFT + DRIFT]);
  });

  test('# duration:N jumps N minutes; a malformed one drifts (#1)', async ({ expect }) => {
    expect.hasAssertions();
    const nine = minutesAt('09:00');
    const result = await run([story('a', ['time: 9:00 AM']), story('b', [`duration: ${JUMP}`]), story('c', ['duration: nope'])]);
    expect(times(result)).toStrictEqual([nine, nine + JUMP, nine + JUMP + DRIFT]);
  });

  test('advance_day resets to the next day at 09:00 first, then the message drifts (#1)', async ({ expect }) => {
    expect.hasAssertions();
    const result = await run([
      // 22:00 on day 0.
      story('a', ['time: 10:00 PM']),
      // Day 1 at 09:00, then a minute of drift: forward across the day boundary.
      story('b', [], { advanceDay: true }),
    ]);
    expect(times(result)).toStrictEqual([minutesAt('22:00'), MINUTES_PER_DAY + minutesAt('09:00') + DRIFT]);
  });

  test('advance_day on an unanchored clock anchors it at the first day, 09:00', async ({ expect }) => {
    expect.hasAssertions();
    const result = await run([story('a'), story('b', [], { advanceDay: true })]);
    expect(times(result)).toStrictEqual([undefined, MINUTES_PER_DAY + minutesAt('09:00') + DRIFT]);
  });
});

describe('forward-only time', () => {
  test('forwardOnlyTime holds over generated time-tag streams (#4, #5)', async ({ expect }) => {
    expect.hasAssertions();
    // The stream mixes parseable snaps (establish, forward, backward-reject) with unparseable ones
    // (drift), so the clock is anchored and the invariant is not vacuous.
    const timeArb = constantFrom('7:00 AM', '9:15 AM', '11:30 PM', '2:45 PM', 'nope');
    const streamArb = array(
      timeArb.map((time): FixtureInput => story('m', [`time: ${time}`])),
      { maxLength: MAX_STREAM },
    );
    const result = await checkInvariant({ foreground: 'chat', systems: [erase(chatSystem)] }, streamArb, forwardOnlyTime);
    expect(result).toStrictEqual({ failed: false, message: 'the property held' });
  });
});
