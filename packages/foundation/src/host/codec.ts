import type { Snapshot } from '#src/sim/snapshot';

/**
 * The persisted form of a snapshot: the kernel's one codec. A save is the snapshot's JSON text;
 * reading one back yields an untyped value the restore path narrows, never a typed cast.
 *
 * @param {Snapshot} snapshot - The snapshot to persist.
 * @returns {string} The snapshot's JSON text.
 */
function encodeSnapshot(snapshot: Readonly<Snapshot>): string {
  return JSON.stringify(snapshot);
}

/**
 * The value a saved snapshot's text holds, for the restore path to narrow.
 *
 * @param {string} text - A save's JSON text.
 * @returns {unknown} The untyped value the text holds.
 */
function decodeSnapshot(text: string): unknown {
  const value: unknown = JSON.parse(text);
  return value;
}

export { decodeSnapshot, encodeSnapshot };
