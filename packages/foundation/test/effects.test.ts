import { EffectPayloadError, fx, parseDataRequest, parseDriveInkOp } from '#src/sim/effect';
import { describe, test } from 'vitest';
import type { DriveInkOp } from '#src/sim/effect';
import type { EffectTarget } from '#src/host/effects';
import type { Snapshot } from '#src/sim/snapshot';
import { execute } from '#src/host/effects';
import { refusingHost } from '#test/refusing-host';
import { storyOf } from '#src/testing/compile';

/** A story offering one choice after its first line. */
const STORY = 'Start.\n* Left\n  Went left.\n* Right\n  Went right.\n';

/** The index ink gives the second choice. */
const RIGHT = 1;

/** A goto instruction, written as the contract types it. */
const GOTO = { knot: 'k', op: 'goto' } satisfies DriveInkOp;

/** A save instruction. */
const SAVE = { id: 's', op: 'save-snap' } satisfies DriveInkOp;

/** A load instruction. */
const LOAD = { id: 's', op: 'load-snap' } satisfies DriveInkOp;

/** A choose instruction. */
const CHOOSE = { index: RIGHT, op: 'choose' } satisfies DriveInkOp;

/** The snapshot a persist effect would save; drive-ink never reads it. */
const SNAPSHOT: Snapshot = { idSeq: 0, ink: '{}', state: {}, version: 1 };

/**
 * A target over a fresh story at its first choice, with an in-memory store and a scheduler that holds its timers.
 *
 * @returns {EffectTarget} The target.
 */
function target(): EffectTarget {
  const ink = storyOf(STORY);
  ink.continue();
  return {
    host: refusingHost(),
    ink,
    resume: (resume) => {
      throw new Error(`no resume expected: ${resume.kind}`);
    },
    snapshot: () => SNAPSHOT,
  };
}

describe('the drive-ink executor', () => {
  test('saves the story and loads it back, undoing a choice taken since', ({ expect }) => {
    expect.hasAssertions();
    const reached = target();
    const atChoice = reached.ink.toJson();
    execute(fx.driveInk({ id: 'slot', op: 'save-snap' }), reached);
    execute(fx.driveInk({ index: RIGHT, op: 'choose' }), reached);
    expect(reached.ink.continue().text).toBe('Right');
    expect(reached.ink.toJson()).not.toBe(atChoice);
    execute(fx.driveInk({ id: 'slot', op: 'load-snap' }), reached);
    expect(reached.ink.toJson()).toBe(atChoice);
    expect(reached.ink.canContinue()).toBe(false);
  });

  test('loads nothing when nothing was saved, leaving the story where it is', ({ expect }) => {
    expect.hasAssertions();
    const reached = target();
    const before = reached.ink.toJson();
    execute(fx.driveInk({ id: 'slot', op: 'load-snap' }), reached);
    expect(reached.ink.toJson()).toBe(before);
  });

  test('leaves the story where it is on a goto', ({ expect }) => {
    expect.hasAssertions();
    const reached = target();
    const before = reached.ink.toJson();
    execute(fx.driveInk({ knot: 'elsewhere', op: 'goto' }), reached);
    expect(reached.ink.toJson()).toBe(before);
  });
});

describe('the effect payload parsers', () => {
  test('read each drive-ink op back from its payload', ({ expect }) => {
    expect.hasAssertions();
    for (const op of [GOTO, SAVE, LOAD]) {
      expect(parseDriveInkOp(op)).toStrictEqual(op);
    }
  });

  test('refuse an unknown op, a missing field, a field of the wrong type, and a payload that is no object', ({ expect }) => {
    expect.hasAssertions();
    expect(() => parseDriveInkOp({ op: 'jump' })).toThrow(new EffectPayloadError('unknown drive-ink op jump'));
    expect(() => parseDriveInkOp({ op: GOTO.op })).toThrow(new EffectPayloadError(`effect payload has no knot: {"op":"${GOTO.op}"}`));
    expect(() => parseDriveInkOp({ index: '1', op: CHOOSE.op })).toThrow(new EffectPayloadError('effect payload index is not a number'));
    expect(() => parseDriveInkOp({ op: 1 })).toThrow(new EffectPayloadError('effect payload op is not a string'));
    expect(() => parseDriveInkOp(GOTO.op)).toThrow(new EffectPayloadError(`effect payload has no op: "${GOTO.op}"`));
  });

  test('read a data request with its params and without', ({ expect }) => {
    expect.hasAssertions();
    expect(parseDataRequest({ params: 'all', query: 'q', source: 's' })).toStrictEqual({ params: 'all', query: 'q', source: 's' });
    expect(parseDataRequest({ query: 'q', source: 's' })).toStrictEqual({ query: 'q', source: 's' });
  });
});
