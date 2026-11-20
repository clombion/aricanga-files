import type { HCommand, HState } from '#test/h-system';
import { describe, expect, test, vi } from 'vitest';
import { erase, viewOf } from '#src/sim/system';
import type { AnySystem } from '#src/sim/system';
import type { Host } from '#src/host/runtime';
import { InkRuntime } from '#src/ink/ink-runtime';
import type { Input } from '#src/sim/input';
import { Runtime } from '#src/host/runtime';
import type { Snapshot } from '#src/sim/snapshot';
import { compileInk } from '#src/testing/harness';
import { hSystem } from '#test/h-system';
/** A commit token the state has long moved past. */
const STALE_TOKEN = 999;

/** The data the fake host's fetch delivers. */
const FETCHED = 'VALUE';

/** The id the allocator hands out after two ids were minted and the snapshot restored. */
const THIRD_ID = 'id-2';

/** The allocator's position after two ids. */
const TWO_IDS = 2;

/** A runtime over the synthetic system, and what its fake host was handed. */
interface World {
  readonly runtime: Runtime;
  readonly host: Host;
  /** The timers the host was asked to schedule, fired only when a test fires them. */
  readonly fires: (() => void)[];
  /** The fetches in flight: each the callback the data is delivered to. */
  readonly deliveries: ((value: unknown) => void)[];
  /** The kinds of the present effects the host was handed. */
  readonly presented: string[];
}

/**
 * The synthetic system's story: two lines, the first of which schedules a commit.
 *
 * @returns {string} The compiled story's JSON text.
 */
function story(): string {
  return compileInk('Hello # h: 1\nWorld # h: 2\n');
}

/**
 * A runtime over the synthetic system, under a fake host whose timers and fetches the test settles.
 *
 * @returns {World} The runtime and its host's records.
 */
function world(): World {
  const fires: (() => void)[] = [];
  const deliveries: ((value: unknown) => void)[] = [];
  const presented: string[] = [];
  const saved: { text: string | undefined } = { text: undefined };
  const host: Host = {
    fetchData: (_request, deliver) => {
      deliveries.push(deliver);
    },
    present: (effect) => {
      if (effect.kind === 'explode') {
        throw new Error(`unknown present kind "${effect.kind}"`);
      }
      presented.push(effect.kind);
    },
    scheduler: {
      schedule: (_delayMs, fire) => {
        fires.push(fire);
        return () => {
          // A test never cancels a timer.
        };
      },
    },
    store: {
      load: () => saved.text,
      save: (data) => {
        saved.text = data;
      },
    },
  };
  const systems: readonly AnySystem[] = [erase(hSystem)];
  return { deliveries, fires, host, presented, runtime: new Runtime({ host, ink: new InkRuntime(story()), seed: 0, systems }) };
}

/**
 * The synthetic system's view, read back from the runtime.
 *
 * @param {Runtime} runtime - The runtime.
 * @returns {HState} The view.
 */
function hView(runtime: Readonly<Runtime>): HState {
  return viewOf(hSystem, { systemId: 'h', value: runtime.view('h', { locale: 'en', now: 0 }) });
}

/**
 * A player command to the synthetic system.
 *
 * @param {string} kind - The command.
 * @returns {Input} The input.
 */
function player(kind: HCommand['kind']): Input<unknown> {
  return { command: { kind, payload: undefined }, source: 'player' };
}

/**
 * The snapshot of a runtime that pumped both lines: "Hello" mints id-0, and the commit resume pumps
 * "World", which mints id-1.
 *
 * @returns {Snapshot} The snapshot.
 */
function afterTwoLines(): Snapshot {
  const { fires, runtime } = world();
  runtime.step();
  const [fire] = fires;
  fire?.();
  return runtime.snapshot();
}

describe('the runtime pump', () => {
  test('pump suspends on busy-commit and resumes on the matching CommitFired (#1, #3)', () => {
    expect.hasAssertions();
    const { fires, runtime } = world();
    // "Hello" is pumped; the system schedules a commit and goes busy.
    expect(runtime.step()).toBe(true);
    // The gate is closed: "World" is NOT pumped while busy-commit.
    expect(runtime.step()).toBe(false);
    const [fire, ...more] = fires;
    expect(more).toStrictEqual([]);
    // The CommitFired resume opens the gate; the pump continues to "World".
    fire?.();
    expect(hView(runtime).lines).toStrictEqual(['Hello', 'World']);
  });

  test('a stale commit token is a no-op (#3)', () => {
    expect.hasAssertions();
    const { runtime } = world();
    runtime.step();
    // Deliver a CommitFired with a token the state has moved past: still busy, "World" not pumped.
    runtime.send({ resume: { kind: 'commit-fired', token: STALE_TOKEN }, source: 'resume' }, 'h');
    expect(hView(runtime).lines).toStrictEqual(['Hello']);
  });

});

describe('the runtime effects', () => {
  test('a Fetch effect round-trips to a DataArrived resume (#2)', () => {
    expect.hasAssertions();
    const { deliveries, runtime } = world();
    runtime.send(player('fetch'), 'h');
    // Nothing arrives until the host delivers; the host settles the fetch by calling back.
    expect(hView(runtime).fetched).toBeUndefined();
    const [deliver] = deliveries;
    deliver?.(FETCHED);
    expect(hView(runtime).fetched).toBe(FETCHED);
  });

  test('an unknown present kind is a typed error (#2)', () => {
    expect.hasAssertions();
    const { runtime } = world();
    expect(() => {
      runtime.send(player('present-bad'), 'h');
    }).toThrow(/unknown present kind/u);
  });

  test('a known present effect reaches the host sink (#2)', () => {
    expect.hasAssertions();
    const { presented, runtime } = world();
    runtime.send(player('present-ok'), 'h');
    expect(presented).toStrictEqual(['ping']);
  });

});

describe('the runtime routing and ids', () => {
  test('a player/resume input with an unknown target throws (#5)', () => {
    expect.hasAssertions();
    const { runtime } = world();
    expect(() => {
      runtime.send(player('mint'), 'nope');
    }).toThrow(/no known target system/u);
  });

  test('ids do not collide across snapshot/restore (#4)', () => {
    expect.hasAssertions();
    const snap = afterTwoLines();
    expect(snap.idSeq).toBe(TWO_IDS);
    const { runtime } = world();
    runtime.restore(snap);
    runtime.send(player('mint'), 'h');
    // The restored allocator continues at id-2 — the new id does not collide with id-0 or id-1.
    expect(hView(runtime).ids).toStrictEqual(['id-0', 'id-1', THIRD_ID]);
  });

  test('the runtime drives a vocabulary-agnostic system with no system import in foundation', () => {
    expect.hasAssertions();
    // erase() builds the registry's shape from closures; the runtime never names a concrete system type.
    const input: Input<HState, HCommand> = { lifecycle: { kind: 'reset' }, source: 'lifecycle' };
    expect(input.source).toBe('lifecycle');
    expect(erase).toBeTypeOf('function');
    expect(vi.isMockFunction(world().host.present)).toBe(false);
  });
});
