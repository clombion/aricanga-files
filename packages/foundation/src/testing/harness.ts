import type { AnySystem, System } from '#src/sim/system';
import type { Command, Input } from '#src/sim/input';
import type { DataRequest, Effect } from '#src/sim/effect';
import type { Snapshot, SystemId } from '#src/sim/snapshot';
import { Compiler } from 'inkjs/full';
import type { Host } from '#src/host/effects';
import { InkRuntime } from '#src/ink/ink-runtime';
import type { ReduceRecord } from '#src/sim/trace';
import type { RenderContext } from '#src/sim/context';
import { Runtime } from '#src/host/runtime';
import { viewOf } from '#src/sim/system';

/** One input a fixture sends, with the system a player or resume input is for. */
interface FixtureInput {
  readonly input: Input<unknown>;
  readonly target?: SystemId;
}

/** @public */
interface FixtureOptions {
  /** Ink source — compiled in-harness, so fixtures are authored as `.ink` text. */
  readonly story: string;
  readonly systems: readonly Readonly<AnySystem>[];
  readonly seed?: number;
  readonly foreground?: SystemId;
  readonly inputs?: readonly FixtureInput[];
  /** Deterministic data responder for `Fetch` effects (declared, not real IO). */
  readonly fetch?: (request: DataRequest) => unknown;
}

/** What a fixture run observed. */
interface FixtureRun {
  /** The kernel-observable `Input→Effect`+`state` stream, in reduction order. */
  readonly trace: readonly ReduceRecord[];
  /** The flattened effect stream across all reductions. */
  readonly effects: readonly Effect[];
  readonly snapshot: Snapshot;
  /** A system's view-model after the run, typed by the system. */
  readonly viewOf: <TState, TCommand extends Command, TEffect extends Effect, TViewModel>(
    system: Readonly<System<TState, TCommand, TEffect, TViewModel>>,
    render?: RenderContext,
  ) => TViewModel;
}

/** The render context a run's views are read with unless the reader gives one. */
const DEFAULT_RENDER: RenderContext = { locale: 'en', now: 0 };

/** How many rounds of timers and fetches a drain may take before it is called divergent. */
const DRAIN_GUARD = 10_000;

/** A drain counts its rounds one at a time. */
const ROUND = 1;

/** The seed a fixture runs with unless it names one, and the round a drain starts at. */
const DEFAULT_SEED = 0;

/**
 * Compile ink source to story JSON headlessly.
 *
 * @param {string} source - The ink source.
 * @returns {string} The compiled story's JSON text.
 */
function compileInk(source: string): string {
  return new Compiler(source).Compile().ToJson() ?? '';
}

/**
 * Answer one fetch: wait for the responder's value, then deliver it to the runtime.
 *
 * @param {Function | undefined} responder - The fixture's data responder, if any.
 * @param {DataRequest} request - The request the fetch makes.
 * @param {Function} deliver - The runtime's callback for the data.
 */
async function respond(
  responder: ((request: DataRequest) => unknown) | undefined,
  request: DataRequest,
  deliver: (value: unknown) => void,
): Promise<void> {
  deliver(await responder?.(request));
}

/*
 * The work a run's host has handed out and not yet finished: the timers it was asked
 * to schedule, which fire only when the harness fires them, and the fetches in flight.
 */
class Pending {
  private timers: (() => void)[] = [];
  private fetches: Readonly<Promise<void>>[] = [];

  /**
   * Hold a timer until the harness fires it.
   *
   * @param {Function} fire - The timer's callback.
   */
  public schedule(fire: () => void): void {
    this.timers.push(fire);
  }

  /**
   * Track a fetch in flight.
   *
   * @param {Promise} fetch - The fetch's settling.
   */
  public track(fetch: Readonly<Promise<void>>): void {
    this.fetches.push(fetch);
  }

  /**
   * Whether nothing is left to fire or to wait for.
   *
   * @returns {boolean} Whether the run is idle.
   */
  public idle(): boolean {
    const [timer] = this.timers;
    const [fetch] = this.fetches;
    return timer === undefined && fetch === undefined;
  }

  /**
   * Fire every held timer, then wait for every fetch in flight to deliver.
   *
   * @returns {Promise} The round's settling.
   */
  public async round(): Promise<void> {
    const due = this.timers;
    this.timers = [];
    for (const fire of due) {
      fire();
    }
    const inFlight = this.fetches;
    this.fetches = [];
    await Promise.all(inFlight);
  }
}

/**
 * Settle a run: fire its timers and wait for its fetches, round after round, until it is idle. Each
 * round settles before the next begins, so the order of rounds is the trace's order.
 *
 * @param {Pending} pending - The run's outstanding work.
 * @param {number} rounds - The rounds already taken.
 * @returns {Promise} The run's settling.
 */
async function settle(pending: Readonly<Pending>, rounds = DEFAULT_SEED): Promise<void> {
  if (pending.idle()) {
    return;
  }
  if (rounds >= DRAIN_GUARD) {
    throw new Error('runFixture: drain did not converge');
  }
  await pending.round();
  await settle(pending, rounds + ROUND);
}

/**
 * Send each input in order, settling the run after each.
 *
 * @param {Runtime} runtime - The run's runtime.
 * @param {Pending} pending - The run's outstanding work.
 * @param {readonly FixtureInput[]} inputs - The inputs still to send.
 * @returns {Promise} The settling of the last input.
 */
async function sendAll(runtime: Readonly<Runtime>, pending: Readonly<Pending>, inputs: readonly FixtureInput[]): Promise<void> {
  const [next, ...rest] = inputs;
  if (next === undefined) {
    return;
  }
  runtime.send(next.input, next.target);
  await settle(pending);
  await sendAll(runtime, pending, rest);
}

/**
 * The deterministic host a fixture runs under: timers fire when the harness fires them, fetches are
 * answered by the fixture's responder, presents go nowhere, and saves stay in memory.
 *
 * @param {FixtureOptions} opts - The fixture.
 * @param {Pending} pending - Where the host hands out its timers and fetches.
 * @returns {Host} The host.
 */
function fixtureHost(opts: Readonly<FixtureOptions>, pending: Readonly<Pending>): Host {
  const saved: { text: string | undefined } = { text: undefined };
  return {
    fetchData: (request, deliver) => {
      pending.track(respond(opts.fetch, request, deliver));
    },
    present: () => {
      // A fixture observes presents through the trace; the host shows nothing.
    },
    scheduler: {
      schedule: (_delayMs, fire) => {
        pending.schedule(fire);
        return () => {
          // A fixture never cancels a timer.
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
}

/**
 * Drive a system over a compiled ink fixture and capture the reduce trace. The
 * runtime is the real one — the harness only supplies deterministic host fakes,
 * a recording observer, and an explicit drain so suspending effects settle in a
 * fixed order before the trace is read.
 *
 * @param {FixtureOptions} opts - The fixture.
 * @returns {Promise<FixtureRun>} What the run observed.
 */
async function runFixture(opts: Readonly<FixtureOptions>): Promise<FixtureRun> {
  const trace: ReduceRecord[] = [];
  const pending = new Pending();
  const runtime = new Runtime({
    host: fixtureHost(opts, pending),
    ink: new InkRuntime(compileInk(opts.story)),
    observer: {
      observe: (record): void => {
        // Capture an immutable copy so a later (mis)mutating reducer can't corrupt the recorded stream.
        trace.push(structuredClone(record));
      },
    },
    seed: opts.seed ?? DEFAULT_SEED,
    systems: opts.systems,
    ...(opts.foreground === undefined ? {} : { foreground: opts.foreground }),
  });
  while (runtime.step()) {
    // Pump ink to the first suspension or idle.
  }
  await settle(pending);
  await sendAll(runtime, pending, opts.inputs ?? []);
  return {
    effects: trace.flatMap((record) => record.effects),
    snapshot: runtime.snapshot(),
    trace,
    viewOf: <TState, TCommand extends Command, TEffect extends Effect, TViewModel>(
      system: Readonly<System<TState, TCommand, TEffect, TViewModel>>,
      render?: RenderContext,
    ): TViewModel => viewOf(system, { systemId: system.id, value: runtime.view(system.id, render ?? DEFAULT_RENDER) }),
  };
}

export { compileInk, runFixture };
export type { FixtureInput, FixtureOptions, FixtureRun };
