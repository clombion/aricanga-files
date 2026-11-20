import type { Snapshot } from '../sim/snapshot';

/**
 * The persisted form of a snapshot: the kernel's one codec. A save is the snapshot's JSON text;
 * reading one back yields an untyped value the restore path narrows, never a typed cast.
 */
export function encodeSnapshot(snapshot: Snapshot): string {
  return JSON.stringify(snapshot);
}

/** The value a saved snapshot's text holds, for the restore path to narrow. */
export function decodeSnapshot(text: string): unknown {
  const value: unknown = JSON.parse(text);
  return value;
}
