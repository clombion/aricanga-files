import { decodeSnapshot, encodeSnapshot } from '#src/host/codec';

/** The system id a carried value is saved under. */
const CARRIER = 'carried';

/** The version, id sequence and ink a carrier snapshot holds: nothing the test reads. */
const ENVELOPE = { idSeq: 0, ink: '', version: 0 } as const;

/**
 * A value as it comes back from a save: written into a snapshot and read back through the kernel's
 * one codec, so it reaches a system's parser untyped, as a restore hands it over.
 *
 * @param {unknown} value - The value saved.
 * @returns {unknown} The value read back, untyped.
 */
function throughSave(value: unknown): unknown {
  return decodeSnapshot(encodeSnapshot({ ...ENVELOPE, state: { [CARRIER]: value } })).state[CARRIER];
}

export { throughSave };
