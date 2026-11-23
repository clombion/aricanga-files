/**
 * The one order of every artefact the harness writes or compares byte for byte, exemption lists'
 * iteration included: by UTF-16 code units, the same under every locale. `harness/lib/lists.ts`
 * re-exports it for the modules outside `exemptions/`.
 */

/** A comparator's answers: the left first, the two equal, the right first. */
const LEFT_FIRST = -1;
const EQUAL = 0;
const RIGHT_FIRST = 1;

/**
 * Order two texts by their UTF-16 code units, the same under every locale: the one order of every
 * artefact the harness writes or compares byte for byte.
 *
 * @param {string} left - A text.
 * @param {string} right - Another text.
 * @returns {number} Their order.
 */
function byCodeUnit(left: string, right: string): number {
  if (left < right) {
    return LEFT_FIRST;
  }
  return left > right ? RIGHT_FIRST : EQUAL;
}

export { byCodeUnit };
