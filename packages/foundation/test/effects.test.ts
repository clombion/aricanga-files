import { EffectPayloadError, fx, parseDataRequest, parseDriveInkOp } from '#src/sim/effect';
import { describe, expect, test } from 'vitest';
import { heldScheduler, memoryStore } from '#src/testing/host-ports';
import type { EffectTarget } from '#src/host/effects';
import type { Snapshot } from '#src/sim/snapshot';
import { execute } from '#src/host/effects';
import { storyOf } from '#src/testing/compile';

/** A story offering one choice after its first line. */
const STORY = 'Start.\n* Left\n  Went left.\n* Right\n  Went right.\n';

/** The index ink gives the second choice. */
const RIGHT = 1;

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
    host: {
      fetchData: (request) => {
        throw new Error(`no fetch expected: ${JSON.stringify(request)}`);
      },
      present: (effect) => {
        throw new Error(`no present expected: ${effect.kind}`);
      },
      scheduler: heldScheduler(() => {
        throw new Error('no timer expected');
      }),
      store: memoryStore(),
    },
    ink,
    resume: (resume) => {
      throw new Error(`no resume expected: ${resume.kind}`);
    },
    snapshot: () => SNAPSHOT,
  };
}

describe('the drive-ink executor', () => {
  test('saves the story and loads it back, undoing a choice taken since', () => {
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

  test('loads nothing when nothing was saved, leaving the story where it is', () => {
    expect.hasAssertions();
    const reached = target();
    const before = reached.ink.toJson();
    execute(fx.driveInk({ id: 'slot', op: 'load-snap' }), reached);
    expect(reached.ink.toJson()).toBe(before);
  });

  test('leaves the story where it is on a goto', () => {
    expect.hasAssertions();
    const reached = target();
    const before = reached.ink.toJson();
    execute(fx.driveInk({ knot: 'elsewhere', op: 'goto' }), reached);
    expect(reached.ink.toJson()).toBe(before);
  });
});

describe('the effect payload parsers', () => {
  test('read each drive-ink op back from its payload', () => {
    expect.hasAssertions();
    expect(parseDriveInkOp({ knot: 'k', op: 'goto' })).toStrictEqual({ knot: 'k', op: 'goto' });
    expect(parseDriveInkOp({ id: 's', op: 'save-snap' })).toStrictEqual({ id: 's', op: 'save-snap' });
    expect(parseDriveInkOp({ id: 's', op: 'load-snap' })).toStrictEqual({ id: 's', op: 'load-snap' });
  });

  test('refuse an unknown op, a missing field, a field of the wrong type, and a payload that is no object', () => {
    expect.hasAssertions();
    expect(() => parseDriveInkOp({ op: 'jump' })).toThrow(new EffectPayloadError('unknown drive-ink op jump'));
    expect(() => parseDriveInkOp({ op: 'goto' })).toThrow(new EffectPayloadError('effect payload has no knot: {"op":"goto"}'));
    expect(() => parseDriveInkOp({ index: '1', op: 'choose' })).toThrow(new EffectPayloadError('effect payload index is not a number'));
    expect(() => parseDriveInkOp({ op: 1 })).toThrow(new EffectPayloadError('effect payload op is not a string'));
    expect(() => parseDriveInkOp('goto')).toThrow(new EffectPayloadError('effect payload has no op: "goto"'));
  });

  test('read a data request with its params and without', () => {
    expect.hasAssertions();
    expect(parseDataRequest({ params: 'all', query: 'q', source: 's' })).toStrictEqual({ params: 'all', query: 'q', source: 's' });
    expect(parseDataRequest({ query: 'q', source: 's' })).toStrictEqual({ query: 'q', source: 's' });
  });
});
