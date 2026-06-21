import type { StoryChunk } from '@narratives/foundation';

export interface ChatMessageVM {
  readonly speaker: string;
  readonly text: string;
}

// Phase 0 STUB reduce: one chunk → one message view-model, parsing a `speaker`
// tag. The real physics kernel (routing, deferral, notifications, time,
// receipts) replaces this in Phase 2 — see docs/roadmap/phase-2-kernel.md.
export function reduceChunk(chunk: StoryChunk): ChatMessageVM {
  const speakerTag = chunk.tags.find((t) => t.trim().startsWith('speaker:'));
  const speaker = speakerTag?.slice(speakerTag.indexOf(':') + 1).trim() ?? '';
  return { speaker, text: chunk.text };
}
