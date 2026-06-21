import type { Effect } from './effect';
import type { StoryChunk } from './story';

// Deterministic context injected into reduce — no Date.now()/Math.random() in
// the kernel. `now` is an injected clock reading; `nextId` is seeded.
export interface ReduceContext {
  readonly now: number;
  nextId(): string;
}

export interface ReduceResult<TState> {
  readonly state: TState;
  readonly effects: readonly Effect[];
}

// The pure kernel signature: (state, chunk, ctx) -> { state, effects }.
export type Reduce<TState> = (
  state: TState,
  chunk: StoryChunk,
  ctx: ReduceContext,
) => ReduceResult<TState>;

/** Deterministic id generator seeded from a snapshot seed (no Math.random). */
export function createIdSequence(seed: number): () => string {
  let n = seed >>> 0;
  return () => {
    // xorshift32 — deterministic, dependency-free.
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    n >>>= 0;
    return n.toString(36);
  };
}
