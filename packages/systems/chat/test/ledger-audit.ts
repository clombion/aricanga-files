/** Reads of the regression ledger (regression-ledger.ts) and of BUG-HISTORY.md, for the ledger audit. */

import type { Disposition } from '#test/regression-ledger';
import { LEDGER } from '#test/regression-ledger';

/** A `## BUG-NNN:` header of BUG-HISTORY.md. */
const BUG_HEADER = /^## (?<id>BUG-\d+):/gmu;

/**
 * The ids of BUG-HISTORY.md's numbered entries.
 *
 * @param {string} markdown - BUG-HISTORY.md's text.
 * @returns {readonly string[]} Each `BUG-NNN` header's id, in file order.
 */
function bugHeaders(markdown: string): readonly string[] {
  const ids: string[] = [];
  for (const { groups } of markdown.matchAll(BUG_HEADER)) {
    const id = groups?.['id'];
    if (id !== undefined) {
      ids.push(id);
    }
  }
  return ids;
}

/** A kernel-physics disposition: the fixture and predicate that keep its bug dead. */
type PhysicsDisposition = Extract<Disposition, { readonly kind: 'kernel-physics' }>;

/**
 * The kernel-physics dispositions of the ledger.
 *
 * @returns {readonly PhysicsDisposition[]} Each, in ledger order.
 */
function physicsDispositions(): readonly PhysicsDisposition[] {
  return LEDGER.flatMap(({ disposition }) => (disposition.kind === 'kernel-physics' ? [disposition] : []));
}

/**
 * The open issues the ledger's dispositions wait on: a kernel-physics or deferred disposition's issue.
 *
 * @returns {readonly string[]} Each issue reference, in ledger order.
 */
function waitedOnIssues(): readonly string[] {
  return LEDGER.flatMap(({ disposition }) => {
    if (disposition.kind === 'kernel-physics' || disposition.kind === 'deferred') {
      return disposition.issue === undefined ? [] : [disposition.issue];
    }
    return [];
  });
}

export { bugHeaders, physicsDispositions, waitedOnIssues };
