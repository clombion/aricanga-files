/**
 * The roles a workspace package declares in its manifest (`"aricanga": { "role": … }`): a closed
 * vocabulary, each word with its tier. A list that varies by kind of package reads the population's
 * selection of a tier (`harness/lib/scope.ts`), never a path.
 */

import { Vocabulary } from './exemptions.ts';

/**
 * What a role decides, as one of three tiers:
 *
 * - `kernel`: the Sans-IO kernel. Its exported unions are contracts, it holds no host API, and it ships.
 * - `product`: production code outside the kernel: a view, an experience.
 * - `test-infrastructure`: a package that exists only to test. Its modules are test support and
 *   coverage does not read them; which runner runs its tests is `test:browser`'s config list.
 */
type Tier = 'kernel' | 'product' | 'test-infrastructure';

/**
 * A package's role. The words are this union; `ROLES` is typed by it, so `tsc` refuses a word
 * missing from `ROLES` or not in the union. (`isolatedDeclarations` keeps an exported type from
 * being inferred from `ROLES` itself.)
 */
type Role = 'experience' | 'foundation' | 'system' | 'test-infrastructure' | 'view';

/** Every role word with its tier: a word is a key, so it is declared once and carries its own tier. */
const ROLES: Vocabulary<Readonly<Record<Role, Tier>>> = new Vocabulary<Readonly<Record<Role, Tier>>>({
  experience: 'product',
  foundation: 'kernel',
  system: 'kernel',
  'test-infrastructure': 'test-infrastructure',
  view: 'product',
});

/**
 * Whether each tier's packages ship, as its tier defines it: the kernel and the product ship, test
 * infrastructure does not. This type is where the facts are declared; each is the literal its tier
 * means, so `tsc` refuses a `TIERS` value without a tier's fact or contradicting it.
 */
type TierFacts = Readonly<{
  kernel: Readonly<{ ships: true }>;
  product: Readonly<{ ships: true }>;
  'test-infrastructure': Readonly<{ ships: false }>;
}>;

/** Each tier with its facts. */
const TIERS: Vocabulary<TierFacts> = new Vocabulary<TierFacts>({
  kernel: { ships: true },
  product: { ships: true },
  'test-infrastructure': { ships: false },
});

/** The role words, for a refusal to name. */
const ROLE_WORDS: readonly string[] = ROLES.words;

/**
 * Whether a manifest's word is a role.
 *
 * @param {unknown} word - The manifest's `aricanga.role`.
 * @returns {boolean} Whether it names a role.
 */
function isRole(word: unknown): word is Role {
  return ROLES.has(word);
}

/**
 * The tier of a role.
 *
 * @param {Role} role - The role.
 * @returns {Tier} Its tier.
 */
function tierOf(role: Role): Tier {
  return ROLES.of(role);
}

/**
 * Whether a role's packages ship: their modules are production code.
 *
 * @param {Role} role - The role.
 * @returns {boolean} Whether they ship.
 */
function ships(role: Role): boolean {
  return TIERS.of(ROLES.of(role)).ships;
}

export { isRole, ROLE_WORDS, ships, tierOf };
export type { Role };
