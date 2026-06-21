// @narratives/foundation — vocabulary-agnostic interactive-fiction engine.
// Phase 1 surface: the full kernel/snapshot/effect/system/router contracts, the
// event bus + services, the effect executor, and the composition root.

export const FOUNDATION_VERSION = '0.0.0';

// Ink runtime (the single inkjs touchpoint).
export { InkRuntime } from './ink/ink-runtime';

// Simulation contracts.
export type { Tag, Choice, StoryChunk } from './sim/story';
export { parseTag } from './sim/story';
export type { Effect, FoundationEffect } from './sim/effect';
export { fx } from './sim/effect';
export type { SystemId, Snapshot } from './sim/snapshot';
export type { ReduceContext, ReduceResult, Reduce } from './sim/context';
export { createIdSequence } from './sim/context';
export type { System } from './sim/system';
export type { Router, RouteContext } from './sim/router';
export { createTagOwnershipRouter } from './sim/router';

// Services + host.
export type { DomainEvent, EventBus, Unsubscribe } from './services/event-bus';
export { createEventBus } from './services/event-bus';
export type { Clock, SaveStore, AnalyticsSink } from './services/services';
export type { EffectExecutor, EffectHandler } from './host/effect-executor';
export { createEffectExecutor } from './host/effect-executor';

// Composition root.
export type { Services, ExperienceConfig, Experience } from './core/create-experience';
export { createExperience } from './core/create-experience';
