// @narratives/foundation — vocabulary-agnostic interactive-fiction engine.
// The closed Input/Effect algebra (ADR-0007): the System contract, the generic
// Sans-IO runtime, the host-owned ink wrapper, and the composition root.

export const FOUNDATION_VERSION = '0.0.0';

// Ink runtime (the single inkjs touchpoint).
export { InkRuntime } from './ink/ink-runtime';
export type { InkFixtures, NameResolver, DataResolver } from './ink/ink-runtime';

// Simulation contracts.
export type { Tag, Choice, ExternalCall, InkStatus, InkStep } from './sim/story';
export { parseTag } from './sim/story';
export type {
  Effect,
  EffectFamily,
  CommitToken,
  ScheduleCommit,
  DataRequest,
  DriveInkOp,
} from './sim/effect';
export { fx } from './sim/effect';
export type { Command, Resume, Lifecycle, Input } from './sim/input';
export type { KernelStatus, ReduceContext, ReduceResult, RenderContext } from './sim/context';
export type { SystemId, Snapshot } from './sim/snapshot';
export type { System, AnySystem } from './sim/system';
export { erase } from './sim/system';
export { assertNever } from './sim/exhaustive';
export type { Router, RouteContext } from './sim/router';
export { createTagOwnershipRouter } from './sim/router';

// Services.
export type { DomainEvent, EventBus, Unsubscribe } from './services/event-bus';
export { createEventBus } from './services/event-bus';
export type { Clock, SaveStore, AnalyticsSink, Scheduler } from './services/services';

// Host runtime + composition root.
export type { Host, RuntimeConfig } from './host/runtime';
export { Runtime } from './host/runtime';
export type { ExperienceConfig, Experience } from './core/create-experience';
export { createExperience } from './core/create-experience';
