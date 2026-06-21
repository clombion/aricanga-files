import type { StoryChunk } from '@narratives/foundation';

export interface ChatMessageVM {
  readonly speaker: string;
  readonly text: string;
}

// Phase 0 STUB reduce: one chunk → one message view-model, parsing a `speaker`
// tag. The real physics kernel (routing, deferral, notifications, time,
// receipts) replaces this in Phase 2 — see docs/roadmap/phase-2-kernel.md.
export function reduceChunk(chunk: StoryChunk): ChatMessageVM {
  const speaker = chunk.tags.find((t) => t.key === 'speaker')?.value ?? '';
  return { speaker, text: chunk.text };
}
