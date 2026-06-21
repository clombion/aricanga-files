// Minimal StoryChunk for the Phase 0 walking skeleton — one unit of ink output.
// Vocabulary-agnostic: text + raw tags, no chat/card concepts. Phase 1 expands
// this (choices, isChoicePoint) — see docs/roadmap/phase-1-foundation-design.md.
export interface StoryChunk {
  readonly text: string;
  readonly tags: readonly string[];
}
