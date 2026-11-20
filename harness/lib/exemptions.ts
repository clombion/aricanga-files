/**
 * The one owner of exemption lists: every entry carries a reason and fails once it matches nothing.
 *
 * Four declarations cover every list a check consults, one module each under `exemptions/`:
 *
 * - `Exemptions`: keys a rule tolerates, each with its reason; an entry no finding matches fails.
 * - `CountedExemptions`: keys a rule tolerates a fixed number of times; a count off either way fails.
 * - `Accepted`: the values a rule defines as valid; consulted by membership, nothing has to match.
 * - `Prefixes`: the starts or ends text matching uses; consulted by `starts` and `ends` only.
 *
 * Keys are strings. A check keyed by a pair builds its key with `site(path, rule)`. No declaration
 * hands its keys to a consumer: a check that needs the keys derives them from its own scan, and the
 * list holds their liveness.
 */

export { Accepted } from './exemptions/accepted.ts';
export { CountedExemptions } from './exemptions/counted.ts';
export type { Mismatch } from './exemptions/counted.ts';
export { StaleExemptionError } from './exemptions/errors.ts';
export { Exemptions } from './exemptions/keyed.ts';
export { Prefixes } from './exemptions/prefixes.ts';
export { site } from './exemptions/reasons.ts';
