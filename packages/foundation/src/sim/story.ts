/*
 * What the host's ink wrapper produces, with no chat/card vocabulary — the
 * kernel's story input unit (ADR-0007). `name`/`data` externals are resolved
 * into `text` host-side and never surface here; only the drain-class externals do.
 */

/** A parsed ink tag: its key, its value when it has one, and the raw text. */
interface Tag {
  readonly key: string;
  readonly value?: string;
  readonly raw: string;
}

/** One of the choices an ink step offers. */
interface Choice {
  readonly index: number;
  readonly text: string;
  readonly tags: readonly Tag[];
}

/*
 * Drain-class ink externals. `request_data` additionally drives the step's
 * `status: 'await-data'` (it suspends the pump); the others are non-suspending.
 */
type ExternalCall =
  | { readonly fn: 'delay_next'; readonly seconds: number }
  | { readonly fn: 'play_sound'; readonly sound: string }
  | { readonly fn: 'advance_day' }
  | {
      readonly fn: 'request_data';
      readonly source: string;
      readonly query: string;
      readonly params?: string;
    };

/** Where ink stands after a step. */
type InkStatus = 'continue' | 'await-choice' | 'await-data' | 'end' | 'error';

/** One continued ink step: its line, tags, choices, externals called and status. */
interface InkStep {
  readonly text: string;
  readonly tags: readonly Tag[];
  readonly choices: readonly Choice[];
  readonly externalCalls: readonly ExternalCall[];
  readonly status: InkStatus;
}

/** A tag with a value: its key, the first separator, and the rest as the value. */
const KEYED_TAG = /^(?<key>[^:]*):(?<value>.*)$/su;

/**
 * Parse a raw ink tag (`"speaker: Pat"`) into a structured Tag.
 *
 * @param {string} raw - The tag's text as ink gives it.
 * @returns {Tag} The tag's key, its value when it has a separator, and the raw text.
 */
function parseTag(raw: string): Tag {
  const groups = KEYED_TAG.exec(raw)?.groups;
  if (groups === undefined) {
    return { key: raw.trim(), raw };
  }
  const { key = '', value = '' } = groups;
  return { key: key.trim(), raw, value: value.trim() };
}

export { parseTag };
export type { Choice, ExternalCall, InkStatus, InkStep, Tag };
