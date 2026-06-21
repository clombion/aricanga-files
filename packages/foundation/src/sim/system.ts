import type { ReduceContext, ReduceResult } from './context';
import type { StoryChunk } from './story';

// The contract every system implements so foundation stays vocabulary-agnostic.
// References only foundation types — never a chat- or card-specific type.
export interface System<TState, TViewModel> {
  readonly id: string;
  /** Tag keys this system claims — the single source of truth for routing. */
  readonly tags: readonly string[];
  init(): TState;
  reduce(state: TState, chunk: StoryChunk, ctx: ReduceContext): ReduceResult<TState>;
  deriveViewModel(state: TState): TViewModel;
  registerComponents(): Promise<void> | void;
}
