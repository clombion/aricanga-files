// @narratives/foundation — vocabulary-agnostic interactive-fiction engine.
//
// Phase 1 surface: the kernel/snapshot contracts plus the ink runtime wrapper.
// Effects host executor, event bus, System interface, router, and the
// composition root are added through the rest of Phase 1.

export const FOUNDATION_VERSION = '0.0.0';

// Ink runtime (the single inkjs touchpoint).
export { InkRuntime } from './ink/ink-runtime';

// Simulation contracts.
export type { Tag, Choice, StoryChunk } from './sim/story';
export { parseTag } from './sim/story';
export type { Effect } from './sim/effect';
export type { SystemId, Snapshot } from './sim/snapshot';
export type { ReduceContext, ReduceResult, Reduce } from './sim/context';
export { createIdSequence } from './sim/context';
