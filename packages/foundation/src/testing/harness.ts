import { Compiler } from 'inkjs/full';
import { type Host, Runtime } from '../host/runtime';
import { InkRuntime } from '../ink/ink-runtime';
import type { RenderContext } from '../sim/context';
import type { DataRequest, Effect } from '../sim/effect';
import type { Command, Input } from '../sim/input';
import type { Snapshot, SystemId } from '../sim/snapshot';
import type { AnySystem } from '../sim/system';
import type { ReduceRecord } from '../sim/trace';

export interface FixtureInput {
  readonly input: Input<unknown, Command>;
  readonly target?: SystemId;
}

export interface FixtureOptions {
  /** Ink source — compiled in-harness, so fixtures are authored as `.ink` text. */
  readonly story: string;
  readonly systems: readonly AnySystem[];
  readonly seed?: number;
  readonly foreground?: SystemId;
  readonly inputs?: readonly FixtureInput[];
  /** Deterministic data responder for `Fetch` effects (declared, not real IO). */
  readonly fetch?: (request: DataRequest) => unknown;
}

export interface FixtureRun {
  /** The kernel-observable `Input→Effect`+`state` stream, in reduction order. */
  readonly trace: readonly ReduceRecord[];
  /** The flattened effect stream across all reductions. */
  readonly effects: readonly Effect[];
  readonly snapshot: Snapshot;
  view(id: SystemId, render?: RenderContext): unknown;
}

const DEFAULT_RENDER: RenderContext = { now: 0, locale: 'en' };
const DRAIN_GUARD = 10_000;

/** Compile ink source to story JSON headlessly. */
export function compileInk(source: string): string {
  return new Compiler(source).Compile().ToJson() ?? '';
}

// Drive a system over a compiled ink fixture and capture the reduce trace. The
// runtime is the real one (task-041) — the harness only supplies deterministic
// host fakes, a recording observer, and an explicit drain so suspending effects
// settle in a fixed order before the trace is read.
export async function runFixture(opts: FixtureOptions): Promise<FixtureRun> {
  const trace: ReduceRecord[] = [];
  const timers: Array<() => void> = [];
  let stored: string | null = null;

  const host: Host = {
    scheduler: {
      schedule: (_delayMs, fire) => {
        timers.push(fire);
        return () => {};
      },
    },
    store: {
      load: () => stored,
      save: (data) => {
        stored = data;
      },
    },
    fetchData: (request) => Promise.resolve(opts.fetch ? opts.fetch(request) : null),
    present: () => {},
  };

  const runtime = new Runtime({
    ink: new InkRuntime(compileInk(opts.story)),
    systems: opts.systems,
    host,
    seed: opts.seed ?? 0,
    observer: {
      observe: (record) => {
        // Capture an immutable copy so a later (mis)mutating reducer can't corrupt
        // the recorded stream (run-twice determinism leans on this).
        trace.push(structuredClone(record) as ReduceRecord);
      },
    },
    ...(opts.foreground !== undefined ? { foreground: opts.foreground } : {}),
  });

  // Settle until a full pass produces no new reductions and no timers remain.
  const drain = async (): Promise<void> => {
    let last = -1;
    let guard = 0;
    while (last !== trace.length || timers.length > 0) {
      if (++guard > DRAIN_GUARD) throw new Error('runFixture: drain did not converge');
      last = trace.length;
      while (timers.length > 0) timers.shift()?.(); // CommitFired → send → pump
      await Promise.resolve(); // let Fetch microtasks resolve and re-enter send
      await Promise.resolve();
    }
  };

  while (runtime.step()) {
    /* pump ink to the first suspension/idle */
  }
  await drain();
  for (const { input, target } of opts.inputs ?? []) {
    runtime.send(input, target);
    await drain();
  }

  return {
    trace,
    effects: trace.flatMap((record) => [...record.effects]),
    snapshot: runtime.snapshot(),
    view: (id, render) => runtime.view(id, render ?? DEFAULT_RENDER),
  };
}
