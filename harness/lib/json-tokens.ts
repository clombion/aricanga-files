/** The tokens of a strict JSON text (RFC 8259): no comment, no trailing comma, nothing a looser reader admits. */

/** One token: a structural mark, a string as written, a number as written, or one of JSON's words. */
interface JsonToken {
  readonly kind: 'mark' | 'number' | 'string' | 'word';
  readonly text: string;
  readonly offset: number;
}

/** A text that is no strict JSON, with the offset where it stops. */
class JsonSyntaxError extends Error {
  public override readonly name = 'JsonSyntaxError';
}

/**
 * One token or a run of whitespace at the reader's position. A
 * string refuses an unescaped control character (`\p{Cc}`, which also refuses DEL and the C1 range
 * RFC 8259 admits raw: stricter, and no held file writes one).
 */
const TOKEN =
  /(?:[ \t\n\r]+)|(?:[{}[\]:,])|(?:"(?:[^"\\\p{Cc}]|\\["\\/bfnrt]|\\u[\dA-Fa-f]{4})*")|(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[Ee][+-]?\d+)?)|(?:true|false|null)/uy;

/** Where a text's reading starts. */
const START = 0;

/** Whitespace, which reads no token. */
const SPACE = /^\s/u;
/** A structural mark. */
const MARK = /^[{}[\]:,]/u;
/** The first letter of `true`, `false` or `null`. */
const WORD = /^[tfn]/u;

/**
 * The kind of a token the pattern read, from its first character; none for whitespace.
 *
 * @param {string} text - The token's text.
 * @returns {JsonToken['kind'] | undefined} Its kind.
 */
function kindOf(text: string): JsonToken['kind'] | undefined {
  if (SPACE.test(text)) {
    return undefined;
  }
  if (MARK.test(text)) {
    return 'mark';
  }
  if (text.startsWith('"')) {
    return 'string';
  }
  return WORD.test(text) ? 'word' : 'number';
}

/** A token read at an offset, or whitespace (no token), and where the next read starts. */
interface Read {
  readonly token: JsonToken | undefined;
  readonly end: number;
}

/**
 * Read one token or one run of whitespace at an offset.
 *
 * @param {string} text - The text.
 * @param {number} offset - Where to read.
 * @returns {Read} What was read, and where the next read starts.
 */
function readAt(text: string, offset: number): Read {
  TOKEN.lastIndex = offset;
  const found = TOKEN.exec(text);
  if (found === null) {
    throw new JsonSyntaxError(`no JSON token at offset ${String(offset)}`);
  }
  const [matched] = found;
  const kind = kindOf(matched);
  return { end: TOKEN.lastIndex, token: kind === undefined ? undefined : { kind, offset, text: matched } };
}

/**
 * A strict JSON text's tokens, in order.
 *
 * @param {string} text - The text.
 * @returns {readonly JsonToken[]} Its tokens.
 */
function tokensOf(text: string): readonly JsonToken[] {
  const tokens: JsonToken[] = [];
  for (let offset = START; offset < text.length;) {
    const { end, token } = readAt(text, offset);
    if (token !== undefined) {
      tokens.push(token);
    }
    offset = end;
  }
  return tokens;
}

export { JsonSyntaxError, tokensOf };
export type { JsonToken };
