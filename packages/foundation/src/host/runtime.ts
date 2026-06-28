import { InkRuntime } from '../ink/ink-runtime';
import type { RenderContext, ReduceContext } from '../sim/context';
import type { DataRequest, DriveInkOp, Effect, ScheduleCommit } from '../sim/effect';
import { assertNever } from '../sim/exhaustive';
import type { Command, Input } from '../sim/input';
import type { Router } from '../sim/router';
import { createTagOwnershipRouter } from '../sim/router';
import type { Snapshot, SystemId } from '../sim/snapshot';
import type { AnySystem } from '../sim/system';
import type { ReduceObserver } from '../sim/trace';
import type { SaveStore, Scheduler } from '../services/services';

// The host shell the runtime drives its impure effects through. The runtime owns
// the loop and the pure resources (ink, id allocation); the host owns the rest.
export interface Host {
  readonly scheduler: Scheduler;
  readonly store: SaveStore;
  fetchData(request: DataRequest): Promise<unknown>;
  present(effect: Effect): void;
}

export interface RuntimeConfig {
  readonly ink: InkRuntime;
  readonly systems: ReadonlyArray<AnySystem>;
  readonly host: Host;
  readonly router?: Router;
  readonly foreground?: SystemId;
  readonly seed?: number;
  readonly version?: number;
  // Reduce-trace observability seam (ADR-0007 event-sourcing): notified of every
  // reduction's `{input, effects, state}`. Adds no Input/Effect.
  readonly observer?: ReduceObserver;
}

const SNAPSHOT_VERSION = 1;

// The system-agnostic Sans-IO host loop (ADR-0007). It owns the ink Story and the
// monotonic id allocator, pumps a system while its `status` is `free` and ink can
// continue, executes returned effects, and feeds the matching `Resume` inputs
// back. Reused unchanged by every system.
export class Runtime {
  private readonly ink: InkRuntime;
  private readonly systems = new Map<SystemId, AnySystem>();
  private readonly states = new Map<SystemId, unknown>();
  private readonly host: Host;
  private readonly router: Router;
  private readonly foreground: SystemId;
  private readonly observer: ReduceObserver | undefined;
  private version: number;
  // The id allocator position — persisted in the snapshot so ids never collide
  // across restore and `reduce` stays referentially transparent.
  private idSeq: number;

  constructor(config: RuntimeConfig) {
    const first = config.systems[0];
    if (first === undefined) throw new Error('Runtime requires at least one system');

    this.ink = config.ink;
    this.host = config.host;
    this.router = config.router ?? createTagOwnershipRouter();
    this.observer = config.observer;
    this.version = config.version ?? SNAPSHOT_VERSION;
    this.idSeq = config.seed ?? 0;

    for (const system of config.systems) this.systems.set(system.id, system);

    this.foreground = config.foreground ?? first.id;
    if (!this.systems.has(this.foreground)) {
      throw new Error(`foreground system "${this.foreground}" is not registered`);
    }

    const initSeed = config.seed ?? 0;
    for (const system of config.systems) this.states.set(system.id, system.init(initSeed));
  }

  /** Drive the system from an inbound value, then pump ink while ready. */
  send(input: Input<unknown, Command>, target?: SystemId): void {
    switch (input.source) {
      case 'story':
        this.deliver(this.router.route(input.step, this.routeCtx()), input);
        break;
      case 'player':
      case 'resume':
        this.deliver(this.requireTarget(target), input);
        break;
      case 'lifecycle':
        for (const id of this.systems.keys()) this.deliver(id, input);
        break;
      default:
        assertNever(input);
    }
    this.pump();
  }

  /** Test seam: advance ink one step if ready. Returns whether it advanced. */
  step(): boolean {
    if (this.blocked() || !this.ink.canContinue()) return false;
    const step = this.ink.continue();
    this.deliver(this.router.route(step, this.routeCtx()), { source: 'story', step });
    return true;
  }

  view(id: SystemId, render: RenderContext): unknown {
    return this.systemOrThrow(id).view(this.states.get(id), render);
  }

  snapshot(): Snapshot {
    const state: Record<SystemId, unknown> = {};
    for (const [id, st] of this.states) state[id] = st;
    return { version: this.version, ink: this.ink.toJson(), idSeq: this.idSeq, state };
  }

  restore(snap: Snapshot): void {
    this.version = snap.version;
    this.idSeq = snap.idSeq;
    this.ink.loadJson(snap.ink);
    for (const [id, st] of Object.entries(snap.state)) {
      if (this.systems.has(id)) this.states.set(id, st);
    }
  }

  // --- internals ---

  private pump(): void {
    while (!this.blocked() && this.ink.canContinue()) {
      const step = this.ink.continue();
      this.deliver(this.router.route(step, this.routeCtx()), { source: 'story', step });
      if (step.status !== 'continue') break;
    }
  }

  private deliver(id: SystemId, input: Input<unknown, Command>): void {
    const system = this.systemOrThrow(id);
    let n = this.idSeq;
    const ctx: ReduceContext = { nextId: () => `id-${n++}` };
    const result = system.reduce(this.states.get(id), input, ctx);
    this.idSeq = n;
    this.states.set(id, result.state);
    this.observer?.observe({ systemId: id, input, effects: result.effects, state: result.state });
    for (const effect of result.effects) this.execute(id, effect);
  }

  private execute(originId: SystemId, effect: Effect): void {
    switch (effect.family) {
      case 'drive-ink':
        this.driveInk(effect.payload as DriveInkOp);
        return;
      case 'schedule': {
        const { delayMs, token } = effect.payload as ScheduleCommit;
        this.host.scheduler.schedule(delayMs, () => {
          this.send({ source: 'resume', resume: { kind: 'commit-fired', token } }, originId);
        });
        return;
      }
      case 'fetch': {
        const request = effect.payload as DataRequest;
        void this.host.fetchData(request).then((value) => {
          this.send({ source: 'resume', resume: { kind: 'data-arrived', request, value } }, originId);
        });
        return;
      }
      case 'present':
        this.host.present(effect);
        return;
      case 'persist':
        this.host.store.save(JSON.stringify(this.snapshot()));
        return;
      default:
        assertNever(effect.family);
    }
  }

  private driveInk(op: DriveInkOp): void {
    switch (op.op) {
      case 'choose':
        this.ink.choose(op.index);
        return;
      case 'save-snap':
        this.host.store.save(this.ink.toJson());
        return;
      case 'load-snap': {
        const json = this.host.store.load();
        if (json !== null) this.ink.loadJson(json);
        return;
      }
      case 'goto':
        // Knot navigation is added with the physics that needs it (task-020).
        return;
      default:
        assertNever(op);
    }
  }

  private routeCtx(): { foreground: SystemId; systems: ReadonlyMap<SystemId, AnySystem> } {
    return { foreground: this.foreground, systems: this.systems };
  }

  private blocked(): boolean {
    for (const [id, state] of this.states) {
      if (this.systemOrThrow(id).status(state) !== 'free') return true;
    }
    return false;
  }

  private requireTarget(target: SystemId | undefined): SystemId {
    if (target === undefined || !this.systems.has(target)) {
      throw new Error(`player/resume input has no known target system (got "${target ?? '<none>'}")`);
    }
    return target;
  }

  private systemOrThrow(id: SystemId): AnySystem {
    const system = this.systems.get(id);
    if (system === undefined) throw new Error(`unknown system "${id}"`);
    return system;
  }
}
