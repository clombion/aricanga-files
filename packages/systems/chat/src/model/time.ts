import type { ChatState } from '#src/state';
import type { InkStep } from '@narratives/foundation';

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
/** The hour an `advance_day` resets the clock to: 09:00. */
const MORNING_HOUR = 9;
const MORNING = MORNING_HOUR * MINUTES_PER_HOUR;
/** A 12-hour clock reads hours 1 to 12; noon and midnight are both 12. */
const TWELVE = 12;
const FIRST_TWELVE_HOUR = 1;
/** The first day an `advance_day` reaches from an unanchored clock. */
const FIRST_DAY = 1;
/** The minutes a message without a `# time:` or `# duration:` tag moves an anchored clock. */
const DRIFT = 1;
const DECIMAL = 10;
const MIDNIGHT = 0;

/** A canonical `HH:MM [AM|PM]` time of day. */
const TIME_OF_DAY = /^\s*(?<hour>\d{1,2}):(?<minute>\d{2})\s*(?<period>AM|PM)?\s*$/iu;

/**
 * Whether an hour and minute name a time: a 24-hour time, or, with a period, an hour from 1 to 12.
 *
 * @param {number} hour - The hour as written.
 * @param {number} minute - The minute as written.
 * @param {string | undefined} period - `AM`, `PM`, or undefined for a 24-hour time.
 * @returns {boolean} Whether the time exists.
 */
function isClockTime(hour: number, minute: number, period: string | undefined): boolean {
  if (hour >= HOURS_PER_DAY || minute >= MINUTES_PER_HOUR) {
    return false;
  }
  return period === undefined || (hour >= FIRST_TWELVE_HOUR && hour <= TWELVE);
}

/**
 * The 24-hour hour a 12-hour clock's hour and period name.
 *
 * @param {number} hour - The hour as written: 1 to 12 with a period, 0 to 23 without.
 * @param {string | undefined} period - `AM`, `PM`, or undefined for a 24-hour time.
 * @returns {number} The hour of the day, 0 to 23.
 */
function hourOfDay(hour: number, period: string | undefined): number {
  if (period === undefined) {
    return hour;
  }
  const fromMidnight = hour === TWELVE ? MIDNIGHT : hour;
  return period === 'PM' ? fromMidnight + TWELVE : fromMidnight;
}

/**
 * Parse a canonical `HH:MM [AM|PM]` tag to its minute of the day. Pure: no `Date` (the reducer is
 * clock-free; formatting is the view's job).
 *
 * @param {string} raw - The tag's value.
 * @returns {number | undefined} The minute of the day, or undefined when the value is not a time.
 */
function parseTimeOfDay(raw: string): number | undefined {
  const groups = TIME_OF_DAY.exec(raw)?.groups;
  if (groups === undefined) {
    return undefined;
  }
  const hour = Number(groups['hour']);
  const minute = Number(groups['minute']);
  const period = groups['period']?.toUpperCase();
  return isClockTime(hour, minute, period) ? hourOfDay(hour, period) * MINUTES_PER_HOUR + minute : undefined;
}

/**
 * The day an absolute clock falls on.
 *
 * @param {number} clock - Absolute minutes.
 * @returns {number} The day, counted from zero.
 */
function dayOf(clock: number): number {
  return Math.floor(clock / MINUTES_PER_DAY);
}

/**
 * The value of a step's tag.
 *
 * @param {InkStep} step - The ink step.
 * @param {string} key - The tag's key.
 * @returns {string | undefined} The value, or undefined when the step has no such tag.
 */
function tagValue(step: InkStep, key: string): string | undefined {
  return step.tags.find((tag) => tag.key === key)?.value;
}

/**
 * Move the clock for a message: the priority `# time:` snap, then a `# duration:N` jump, then
 * auto-drift. A snap earlier than an anchored clock is rejected; a jump and drift only add, and are
 * inert until an anchor exists. A malformed time or duration tag falls through to drift.
 *
 * @param {number | undefined} clock - The clock before the message, if anchored.
 * @param {InkStep} step - The message's step.
 * @returns {number | undefined} The clock after the message.
 */
function messageClock(clock: number | undefined, step: InkStep): number | undefined {
  const timeTag = tagValue(step, 'time');
  const snap = timeTag === undefined ? undefined : parseTimeOfDay(timeTag);
  if (snap !== undefined) {
    const candidate = (clock === undefined ? MIDNIGHT : dayOf(clock)) * MINUTES_PER_DAY + snap;
    // Establish the anchor, else move forward only.
    return clock === undefined || candidate > clock ? candidate : clock;
  }
  if (clock === undefined) {
    return undefined;
  }
  const durationTag = tagValue(step, 'duration');
  const jump = durationTag === undefined ? Number.NaN : Number.parseInt(durationTag, DECIMAL);
  return clock + (Number.isNaN(jump) ? DRIFT : jump);
}

/**
 * The clock an `advance_day` resets to: the next day's morning.
 *
 * @param {number | undefined} clock - The clock before, if anchored.
 * @returns {number} The morning of the day after, or of the first day from an unanchored clock.
 */
function nextMorning(clock: number | undefined): number {
  const day = clock === undefined ? FIRST_DAY : dayOf(clock) + FIRST_DAY;
  return day * MINUTES_PER_DAY + MORNING;
}

/**
 * Advance the simulation clock for a story step. `advance_day` (an ink external, fired during
 * Continue) comes first, resetting to the next day's morning; then a message (non-empty text) moves
 * the clock (`messageClock`). The clock is absolute minutes, absent while unanchored, and
 * forward-only by construction.
 *
 * @param {ChatState} state - The chat slice.
 * @param {InkStep} step - The story step.
 * @returns {ChatState} The slice with the clock moved; the same reference when nothing changed.
 */
function advanceTime(state: ChatState, step: InkStep): ChatState {
  const advancesDay = step.externalCalls.some((call) => call.fn === 'advance_day');
  const dayClock = advancesDay ? nextMorning(state.clock) : state.clock;
  const clock = step.text === '' ? dayClock : messageClock(dayClock, step);
  return clock === undefined || clock === state.clock ? state : { ...state, clock };
}

export { advanceTime };
