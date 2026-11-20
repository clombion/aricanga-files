import type { Snapshot } from '#src/sim/snapshot';
import { readerOf } from '#src/sim/parse';

/** The readers of a save's envelope, refusing in the codec's name. */
const READ = readerOf('snapshot');

/**
 * The persisted form of a snapshot: the kernel's one codec. A save is the snapshot's JSON text;
 * reading one back parses its envelope, and each system parses its own state on restore.
 *
 * @param {Snapshot} snapshot - The snapshot to persist.
 * @returns {string} The snapshot's JSON text.
 */
function encodeSnapshot(snapshot: Readonly<Snapshot>): string {
  return JSON.stringify(snapshot);
}

/**
 * The snapshot a save's text holds: its envelope read field by field, refusing a missing or
 * mistyped field by name. Each system's state stays untyped here; `Runtime.restore` hands it to
 * that system's own parser.
 *
 * @param {string} text - A save's JSON text.
 * @returns {Snapshot} The snapshot the text holds.
 */
function decodeSnapshot(text: string): Snapshot {
  const value = READ.object(JSON.parse(text), 'snapshot');
  return {
    idSeq: READ.number(value['idSeq'], 'idSeq'),
    ink: READ.string(value['ink'], 'ink'),
    state: READ.object(value['state'], 'state'),
    version: READ.number(value['version'], 'version'),
  };
}

export { decodeSnapshot, encodeSnapshot };
