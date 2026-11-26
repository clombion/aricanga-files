/**
 * The roles a workspace package declares in its manifest (`"aricanga": { "role": … }`): a closed
 * vocabulary, each word with its tier. A list that varies by kind of package reads the population's
 * selection (`harness/lib/scope.ts`: the members that ship and the test infrastructure, parted by
 * their tier's `ships`; each tier's members, for a reader total over the tiers), never a path.
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

/** A record whose every value is a tier, keyed by its own words: the constraint `RoleTiers` is checked against. */
type Tiered<Words extends Readonly<{ [Word in keyof Words]: Tier }>> = Words;

/**
 * Each role's tier, as a literal, so a type can read which roles ship. The role words are this
 * record's keys and are written here and in `ROLES`, which is typed by it: `tsc` refuses a word in
 * one and not the other, and a tier outside `Tier`.
 */
type RoleTiers = Tiered<
  Readonly<{
    experience: 'product';
    foundation: 'kernel';
    system: 'kernel';
    'test-infrastructure': 'test-infrastructure';
    view: 'product';
  }>
>;

/**
 * A package's role: a key of `RoleTiers`, a type derived from a type (`isolatedDeclarations` keeps
 * an exported type from being inferred from `ROLES` itself).
 */
type Role = keyof RoleTiers;

/** Every role word with its tier: each word a key of `RoleTiers`, carrying its own tier. */
const ROLES: Vocabulary<RoleTiers> = new Vocabulary<RoleTiers>({
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

/** Each tier with its facts: its words are `Tier`'s, so `tsc` refuses a word of one missing from the other. */
const TIERS: Vocabulary<TierFacts> = new Vocabulary<TierFacts>({
  kernel: { ships: true },
  product: { ships: true },
  'test-infrastructure': { ships: false },
} satisfies Readonly<Record<Tier, TierFacts[Tier]>>);

/** The roles whose tier ships. */
type ShippingRole = { [Each in Role]: TierFacts[RoleTiers[Each]]['ships'] extends true ? Each : never }[Role];

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

/**
 * Whether a role's packages are test infrastructure: they exist only to test, so their modules are
 * test support and only a non-production module may import them. It is the one answer to "which
 * members are test infrastructure"; no role or tier word decides it elsewhere.
 *
 * @param {Role} role - The role.
 * @returns {boolean} Whether its packages are test infrastructure: its tier does not ship.
 */
function isTestInfrastructure(role: Role): boolean {
  return !ships(role);
}

export { isRole, isTestInfrastructure, ROLE_WORDS, ships, tierOf };
export type { Role, ShippingRole, Tier };
