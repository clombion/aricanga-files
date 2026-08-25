import type { InkStep } from '@narratives/foundation';
import type { ChatState } from '../state';

const MINUTES_PER_DAY = 1440;
const MORNING = 9 * 60; // 09:00 — the start-of-day time an `advance_day` resets to.

/** Parse a canonical `HH:MM [AM|PM]` tag to minute-of-day, or null if unparseable.
 * Pure — no `Date` (the reducer is clock-free; formatting is the view's job). */
export function parseTimeOfDay(raw: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i.exec(raw);
  if (m === null) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  const period = m[3]?.toUpperCase();
  if (period !== undefined && (hour < 1 || hour > 12)) return null; // AM/PM requires 1–12
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

const dayOf = (clock: number): number => Math.floor(clock / MINUTES_PER_DAY);

// Advance the simulation clock for a Story step (task-023). Order: `advance_day`
// (an ink external, fires during Continue) first, resetting to the next day's
// morning; then, for a message (non-empty text), the priority `# time:` snap →
// `# duration:N` jump → auto-drift (+1). The clock is absolute minutes, or null
// while unanchored. Forward-only by construction: a snap earlier than an anchored
// clock is rejected; drift/duration only add; drift/duration are inert until an
// anchor exists. Returns the same reference when nothing changed.
export function advanceTime(state: ChatState, step: InkStep): ChatState {
  let clock = state.clock;

  if (step.externalCalls.some((c) => c.fn === 'advance_day')) {
    const nextDay = clock === null ? 1 : dayOf(clock) + 1;
    clock = nextDay * MINUTES_PER_DAY + MORNING;
  }

  if (step.text !== '') {
    const timeTag = step.tags.find((t) => t.key === 'time')?.value;
    const durationTag = step.tags.find((t) => t.key === 'duration')?.value;
    const snap = timeTag !== undefined ? parseTimeOfDay(timeTag) : null;
    const jump = durationTag !== undefined ? Number.parseInt(durationTag, 10) : Number.NaN;

    if (snap !== null) {
      const candidate = (clock === null ? 0 : dayOf(clock)) * MINUTES_PER_DAY + snap;
      if (clock === null || candidate > clock) clock = candidate; // establish, else forward-only
    } else if (!Number.isNaN(jump) && clock !== null) {
      clock += jump;
    } else if (clock !== null) {
      clock += 1; // auto-drift (also the fall-through for a malformed time/duration tag)
    }
  }

  return clock === state.clock ? state : { ...state, clock };
}
