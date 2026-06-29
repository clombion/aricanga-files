// What the host's ink wrapper produces, with no chat/card vocabulary — the
// kernel's story input unit (ADR-0007). `name`/`data` externals are resolved
// into `text` host-side and never surface here; only the drain-class externals do.

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

// Drain-class ink externals. `request_data` additionally drives the step's
// `status: 'await-data'` (it suspends the pump); the others are non-suspending.
export type ExternalCall =
  | { readonly fn: 'delay_next'; readonly seconds: number }
  | { readonly fn: 'play_sound'; readonly sound: string }
  | { readonly fn: 'advance_day' }
  | {
      readonly fn: 'request_data';
      readonly source: string;
      readonly query: string;
      readonly params?: string;
    };

export type InkStatus = 'continue' | 'await-choice' | 'await-data' | 'end' | 'error';

export interface InkStep {
  readonly text: string;
  readonly tags: readonly Tag[];
  readonly choices: readonly Choice[];
  readonly externalCalls: readonly ExternalCall[];
  readonly status: InkStatus;
}

/** Parse a raw ink tag (`"speaker: Pat"`) into a structured Tag. */
export function parseTag(raw: string): Tag {
  const i = raw.indexOf(':');
  if (i === -1) return { key: raw.trim(), raw };
  return { key: raw.slice(0, i).trim(), value: raw.slice(i + 1).trim(), raw };
}
