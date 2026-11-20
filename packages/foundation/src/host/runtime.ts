import type { EffectTarget, Host } from './effects';
import type { ReduceContext, RenderContext } from '#src/sim/context';
import type { Snapshot, SystemId } from '#src/sim/snapshot';
import type { AnySystem } from '#src/sim/system';
import type { Effect } from '#src/sim/effect';
import type { InkRuntime } from '#src/ink/ink-runtime';
import type { Input } from '#src/sim/input';
import type { ReduceObserver } from '#src/sim/trace';
import type { Router } from '#src/sim/router';
import { assertNever } from '#src/sim/exhaustive';
import { createTagOwnershipRouter } from '#src/sim/router';
import { execute } from './effects';

/** @public */
interface RuntimeConfig {
  readonly ink: Readonly<InkRuntime>;
  readonly systems: readonly Readonly<AnySystem>[];
  readonly host: Readonly<Host>;
  readonly router?: Readonly<Router>;
  readonly foreground?: SystemId;
  readonly seed?: number;
  readonly version?: number;
  /**
   * Reduce-trace observability seam (ADR-0007 event-sourcing): notified of every
   * reduction's `{input, effects, state}`. Adds no Input/Effect.
   */
  readonly observer?: Readonly<ReduceObserver>;
}

/** The snapshot format version a runtime writes unless told otherwise. */
const SNAPSHOT_VERSION = 1;

/** The seed, and the first id, of a runtime given none. */
const DEFAULT_SEED = 0;

/**
 * The registry of systems by id, in the order they were given.
 *
 * @param {readonly AnySystem[]} systems - The systems, the first of them the default foreground.
 * @returns {Map} Each system under its id.
 */
function registryOf(systems: readonly Readonly<AnySystem>[]): ReadonlyMap<SystemId, Readonly<AnySystem>> {
  if (systems.length === DEFAULT_SEED) {
    throw new Error('Runtime requires at least one system');
  }
  return new Map(systems.map((system) => [system.id, system]));
}

/**
 * The foreground system: the one named, or the first registered; it must be registered.
 *
 * @param {string | undefined} named - The foreground the config names, if any.
 * @param {ReadonlyMap} systems - The registry.
 * @returns {string} The foreground system's id.
 */
function foregroundOf(named: SystemId | undefined, systems: Readonly<ReadonlyMap<SystemId, Readonly<AnySystem>>>): SystemId {
  const [first] = systems.keys();
  const foreground = named ?? first;
  if (foreground === undefined || !systems.has(foreground)) {
    throw new Error(`foreground system "${foreground ?? '<none>'}" is not registered`);
  }
  return foreground;
}

/*
 * The system-agnostic Sans-IO host loop (ADR-0007). It owns the ink Story and the
 * monotonic id allocator, pumps a system while its `status` is `free` and ink can
 * continue, executes returned effects, and feeds the matching `Resume` inputs
 * back. Reused unchanged by every system.
 */
class Runtime {
  private readonly ink: Readonly<InkRuntime>;
  private readonly systems: ReadonlyMap<SystemId, Readonly<AnySystem>>;
  private readonly states = new Map<SystemId, unknown>();
  private readonly host: Readonly<Host>;
  private readonly router: Readonly<Router>;
  private readonly foreground: SystemId;
  private readonly observer: Readonly<ReduceObserver> | undefined;
  private version: number;
  /**
   * The id allocator position — persisted in the snapshot so ids never collide
   * across restore and `reduce` stays referentially transparent.
   */
  private idSeq: number;

  public constructor(config: Readonly<RuntimeConfig>) {
    this.ink = config.ink;
    this.host = config.host;
    this.router = config.router ?? createTagOwnershipRouter();
    this.observer = config.observer;
    this.version = config.version ?? SNAPSHOT_VERSION;
    this.idSeq = config.seed ?? DEFAULT_SEED;
    this.systems = registryOf(config.systems);
    this.foreground = foregroundOf(config.foreground, this.systems);
    for (const system of config.systems) {
      this.states.set(system.id, system.init(config.seed ?? DEFAULT_SEED));
    }
  }

  /**
   * Drive the system from an inbound value, then pump ink while ready.
   *
   * @param {Input} input - The inbound value.
   * @param {string} [target] - The system a player or resume input is for.
   */
  public send(input: Input<unknown>, target?: SystemId): void {
    switch (input.source) {
      case 'story': {
        this.deliver(this.router.route(input.step, this.routeContext()), input);
        break;
      }
      case 'player':
      case 'resume': {
        this.deliver(this.requireTarget(target), input);
        break;
      }
      case 'lifecycle': {
        for (const id of this.systems.keys()) {
          this.deliver(id, input);
        }
        break;
      }
      default: {
        assertNever(input);
      }
    }
    this.pump();
  }

  /**
   * Test seam: advance ink one step if ready.
   *
   * @returns {boolean} Whether it advanced.
   */
  public step(): boolean {
    if (this.blocked() || !this.ink.canContinue()) {
      return false;
    }
    this.advance();
    return true;
  }

  /**
   * A system's view-model of its current state.
   *
   * @param {string} id - The system.
   * @param {RenderContext} render - The render-time context.
   * @returns {unknown} The system's view-model.
   */
  public view(id: SystemId, render: RenderContext): unknown {
    return this.systemOrThrow(id).view(this.states.get(id), render);
  }

  /**
   * The runtime's whole state: every system's state, ink's, and the id allocator.
   *
   * @returns {Snapshot} The snapshot.
   */
  public snapshot(): Snapshot {
    return { idSeq: this.idSeq, ink: this.ink.toJson(), state: Object.fromEntries(this.states), version: this.version };
  }

  /**
   * Restore a snapshot: ink, the id allocator, and the state of each registered system it holds,
   * each parsed by its system.
   *
   * @param {Snapshot} snap - The snapshot.
   */
  public restore(snap: Snapshot): void {
    this.version = snap.version;
    this.idSeq = snap.idSeq;
    this.ink.loadJson(snap.ink);
    for (const [id, state] of Object.entries(snap.state)) {
      const system = this.systems.get(id);
      if (system !== undefined) {
        this.states.set(id, system.parseState(state));
      }
    }
  }

  private advance(): InkStatusAfter {
    const step = this.ink.continue();
    this.deliver(this.router.route(step, this.routeContext()), { source: 'story', step });
    return step.status;
  }

  private pump(): void {
    while (!this.blocked() && this.ink.canContinue()) {
      if (this.advance() !== 'continue') {
        break;
      }
    }
  }

  private deliver(id: SystemId, input: Input<unknown>): void {
    const system = this.systemOrThrow(id);
    const ctx: ReduceContext = { nextId: () => this.nextId() };
    const result = system.reduce(this.states.get(id), input, ctx);
    this.states.set(id, result.state);
    this.observer?.observe({ effects: result.effects, input, state: result.state, systemId: id });
    for (const effect of result.effects) {
      this.execute(id, effect);
    }
  }

  private nextId(): string {
    const id = `id-${this.idSeq}`;
    this.idSeq += 1;
    return id;
  }

  private execute(originId: SystemId, effect: Effect): void {
    const target: EffectTarget = {
      host: this.host,
      ink: this.ink,
      resume: (resume) => {
        this.send({ resume, source: 'resume' }, originId);
      },
      snapshot: () => this.snapshot(),
    };
    execute(effect, target);
  }

  private routeContext(): { readonly foreground: SystemId; readonly systems: ReadonlyMap<SystemId, Readonly<AnySystem>> } {
    return { foreground: this.foreground, systems: this.systems };
  }

  private blocked(): boolean {
    for (const [id, state] of this.states) {
      if (this.systemOrThrow(id).status(state) !== 'free') {
        return true;
      }
    }
    return false;
  }

  private requireTarget(target: SystemId | undefined): SystemId {
    if (target === undefined || !this.systems.has(target)) {
      throw new Error(`player/resume input has no known target system (got "${target ?? '<none>'}")`);
    }
    return target;
  }

  private systemOrThrow(id: SystemId): Readonly<AnySystem> {
    const system = this.systems.get(id);
    if (system === undefined) {
      throw new Error(`unknown system "${id}"`);
    }
    return system;
  }
}

/** The status of the step a pump just advanced to. */
type InkStatusAfter = ReturnType<Readonly<InkRuntime>['continue']>['status'];

export { Runtime };
export type { RuntimeConfig };
export type { Host } from './effects';
