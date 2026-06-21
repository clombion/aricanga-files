// What ink emits, with no chat/card vocabulary — the kernel's input unit.
// Phase 1 contract (supersedes the Phase 0 stub StoryChunk).

export interface Tag {
  readonly key: string;
  readonly value?: string;
  readonly raw: string;
}

export interface Choice {
  readonly index: number;
  readonly text: string;
  readonly tags: readonly Tag[];
}

export interface StoryChunk {
  readonly text: string;
  readonly tags: readonly Tag[];
  readonly choices: readonly Choice[];
  readonly isChoicePoint: boolean;
}

/** Parse a raw ink tag (`"speaker: Pat"`) into a structured Tag. */
export function parseTag(raw: string): Tag {
  const i = raw.indexOf(':');
  if (i === -1) return { key: raw.trim(), raw };
  return { key: raw.slice(0, i).trim(), value: raw.slice(i + 1).trim(), raw };
}
