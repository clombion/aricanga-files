/**
 * The one owner of exemption lists: every list a check consults is declared here, by its kind. A
 * tolerated key carries a reason and fails once it matches nothing; a defined value, prefix or word
 * need not match.
 *
 * The declaration kinds, `KINDS`, cover every list a check consults, one module each under
 * `exemptions/`, each with how it is consulted:
 *
 * - `Exemptions`: keys a rule tolerates, each with its reason; an entry no finding matches fails.
 * - `CountedExemptions`: keys a rule tolerates a fixed number of times; a count off either way fails.
 * - `Accepted`: the values a rule defines as valid; consulted by membership, nothing has to match.
 * - `Prefixes`: the starts or ends text matching uses; consulted by `starts` and `ends` only.
 * - `Vocabulary`: the words of a closed vocabulary, each with its facts; consulted by `has`, read by
 *   `of`, nothing has to match.
 *
 * Keys are strings. A check keyed by a pair builds its key with `site(path, rule)`. A list of
 * tolerated keys holds their liveness only through its consulting calls, which fail on an entry
 * nothing matched; its `entries` can be read (a test reads them to hold each key to the listing), and
 * reading them checks nothing. The defining kinds hand out what they define: `Accepted.values`, and
 * `Vocabulary.words` with each word's facts.
 */

import { Vocabulary } from './exemptions/vocabulary.ts';

/** How a declaration of a kind is consulted: by a call that fails on a stale entry, or by any read. */
type Consulted = 'call' | 'read';

/** A declaration kind: a class this module exports, by name. */
type Kind = 'Accepted' | 'CountedExemptions' | 'Exemptions' | 'Prefixes' | 'Vocabulary';

/** Every declaration kind with how it is consulted; the exemption fence reads it. */
const KINDS: Vocabulary<Readonly<Record<Kind, Consulted>>> = new Vocabulary<Readonly<Record<Kind, Consulted>>>({
  Accepted: 'read',
  CountedExemptions: 'call',
  Exemptions: 'call',
  Prefixes: 'read',
  Vocabulary: 'read',
});

export { KINDS };
export type { Kind };

export { Accepted } from './exemptions/accepted.ts';
export { CountedExemptions } from './exemptions/counted.ts';
export type { Mismatch } from './exemptions/counted.ts';
export { StaleExemptionError } from './exemptions/errors.ts';
export { Exemptions } from './exemptions/keyed.ts';
export { Prefixes } from './exemptions/prefixes.ts';
export { Vocabulary } from './exemptions/vocabulary.ts';
export { site } from './exemptions/reasons.ts';
