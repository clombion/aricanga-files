import type { AnalyticsSink, Clock, SaveStore } from '../services/services';
import type { EventBus } from '../services/event-bus';
import type { Effect } from '../sim/effect';
import { createIdSequence } from '../sim/context';
import type { ReduceContext } from '../sim/context';
import { type RouteContext, type Router, createTagOwnershipRouter } from '../sim/router';
import type { Snapshot, SystemId } from '../sim/snapshot';
import type { StoryChunk } from '../sim/story';
import type { System } from '../sim/system';

export interface Services {
  readonly clock: Clock;
  readonly store: SaveStore;
  readonly analytics: AnalyticsSink;
  readonly bus: EventBus;
}

export interface ExperienceConfig {
  readonly systems: ReadonlyArray<System<unknown, unknown>>;
  readonly services: Services;
  readonly foreground?: SystemId;
  readonly router?: Router;
  readonly seed?: number;
}

export interface Experience {
  /** Route one chunk to the owning system and return its effects. */
  dispatch(chunk: StoryChunk): readonly Effect[];
  snapshot(): Snapshot<Record<SystemId, unknown>>;
  viewModel(id: SystemId): unknown;
}

// Composition root — instance-scoped services, no singletons. Phase 1 scope:
// compose systems (registry + router) and dispatch a chunk to the owning system's
// reduce. Effect execution and the ink loop are wired in Phases 2/3.
export function createExperience(config: ExperienceConfig): Experience {
  const first = config.systems[0];
  if (first === undefined) {
    throw new Error('createExperience requires at least one system');
  }

  const registry = new Map<SystemId, System<unknown, unknown>>();
  for (const system of config.systems) registry.set(system.id, system);

  const foreground = config.foreground ?? first.id;
  if (!registry.has(foreground)) {
    throw new Error(`foreground system "${foreground}" is not registered`);
  }

  const router = config.router ?? createTagOwnershipRouter();
  const seed = config.seed ?? 1;
  const nextId = createIdSequence(seed);

  const states = new Map<SystemId, unknown>();
  for (const system of config.systems) {
    states.set(system.id, system.init());
    void system.registerComponents();
  }

  const routeCtx: RouteContext = { foreground, systems: registry };

  const systemOrThrow = (id: SystemId): System<unknown, unknown> => {
    const system = registry.get(id);
    if (system === undefined) throw new Error(`unknown system "${id}"`);
    return system;
  };

  return {
    dispatch(chunk) {
      const id = router.route(chunk, routeCtx);
      const system = systemOrThrow(id);
      const ctx: ReduceContext = { now: config.services.clock.now(), nextId };
      const result = system.reduce(states.get(id), chunk, ctx);
      states.set(id, result.state);
      return result.effects;
    },
    snapshot() {
      const systems: Record<SystemId, unknown> = {};
      for (const [id, state] of states) systems[id] = state;
      return { version: 1, ink: '', seed, systems };
    },
    viewModel(id) {
      return systemOrThrow(id).deriveViewModel(states.get(id));
    },
  };
}
