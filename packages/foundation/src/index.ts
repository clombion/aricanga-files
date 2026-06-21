// @narratives/foundation — vocabulary-agnostic interactive-fiction engine.
//
// Phase 0 surface: a version marker plus the ink runtime wrapper and the
// StoryChunk type used by the walking skeleton. The real contracts (Snapshot,
// Effect, System, the kernel reduce signature, the composition root) land in
// Phase 1 — see docs/roadmap/phase-1-foundation-design.md.

export const FOUNDATION_VERSION = '0.0.0';

export { InkRuntime } from './ink/ink-runtime';
export type { StoryChunk } from './ink/story-chunk';
