import type { DataRequest, DriveInkOp, Effect, EffectFamily } from '#src/sim/effect';
import type { SaveStore, Scheduler } from '#src/services/services';
import { parseDataRequest, parseDriveInkOp, parseScheduleCommit } from '#src/sim/effect';
import type { InkRuntime } from '#src/ink/ink-runtime';
import type { Resume } from '#src/sim/input';
import type { Snapshot } from '#src/sim/snapshot';
import { encodeSnapshot } from './codec';

/*
 * The host shell the runtime drives its impure effects through. The runtime owns
 * the loop and the pure resources (ink, id allocation); the host owns the rest,
 * asynchrony included: a fetch hands the host a `deliver` callback, which the host
 * calls with the data once it has it, so the runtime itself never awaits.
 */
interface Host {
  readonly scheduler: Scheduler;
  readonly store: SaveStore;
  readonly fetchData: (request: DataRequest, deliver: (value: unknown) => void) => void;
  readonly present: (effect: Effect) => void;
}

/** What executing an effect reaches: the host, the ink story, the way back in, and the state to save. */
interface EffectTarget {
  readonly host: Readonly<Host>;
  readonly ink: Readonly<InkRuntime>;
  /** Feed a suspending effect's completion back to the system that asked for it. */
  readonly resume: (resume: Resume<unknown>) => void;
  /** The runtime's whole state, for a `persist` effect. */
  readonly snapshot: () => Snapshot;
}

/** Each `drive-ink` op's handler, taking the op of its own kind. */
type DriveInkHandlers = {
  readonly [TOp in DriveInkOp['op']]: (op: Extract<DriveInkOp, { readonly op: TOp }>, target: Readonly<EffectTarget>) => void;
};

/** How the host carries out each `drive-ink` instruction against its ink story. */
const DRIVE_INK: DriveInkHandlers = {
  choose: (op, target) => {
    target.ink.choose(op.index);
  },
  goto: () => {
    // Knot navigation is added with the physics that needs it.
  },
  'load-snap': (_op, target) => {
    const json = target.host.store.load();
    if (json !== undefined) {
      target.ink.loadJson(json);
    }
  },
  'save-snap': (_op, target) => {
    target.host.store.save(target.ink.toJson());
  },
};

/**
 * Carry out a `drive-ink` instruction against the host's ink story.
 *
 * @param {DriveInkOp} op - The instruction.
 * @param {EffectTarget} target - The host and the ink story.
 */
function driveInk<TOp extends DriveInkOp['op']>(op: Extract<DriveInkOp, { readonly op: TOp }>, target: Readonly<EffectTarget>): void {
  const handler: DriveInkHandlers[TOp] = DRIVE_INK[op.op];
  handler(op, target);
}

/** How each effect family is carried out: a host family goes to the host, a suspending one resumes its system. */
const FAMILIES: Readonly<Record<EffectFamily, (effect: Effect, target: Readonly<EffectTarget>) => void>> = {
  'drive-ink': (effect, target) => {
    driveInk(parseDriveInkOp(effect.payload), target);
  },
  fetch: (effect, target) => {
    const request = parseDataRequest(effect.payload);
    target.host.fetchData(request, (value) => {
      target.resume({ kind: 'data-arrived', request, value });
    });
  },
  persist: (_effect, target) => {
    target.host.store.save(encodeSnapshot(target.snapshot()));
  },
  present: (effect, target) => {
    target.host.present(effect);
  },
  schedule: (effect, target) => {
    const { delayMs, token } = parseScheduleCommit(effect.payload);
    target.host.scheduler.schedule(delayMs, () => {
      target.resume({ kind: 'commit-fired', token });
    });
  },
};

/**
 * Carry out one effect.
 *
 * @param {Effect} effect - The effect a reduction returned.
 * @param {EffectTarget} target - What the effect reaches.
 */
function execute(effect: Effect, target: Readonly<EffectTarget>): void {
  FAMILIES[effect.family](effect, target);
}

export { execute };
export type { EffectTarget, Host };
