/**
 * The roles a workspace package declares in its manifest (`"aricanga": { "role": … }`): a closed
 * vocabulary, each word with its facts. A list that varies by kind of package reads a fact here, never
 * a path.
 */

import { Vocabulary } from './exemptions.ts';

/** What a role decides: whether its packages are the kernel, and whether they ship. */
interface RoleFacts {
  /** The Sans-IO kernel: its exported unions are contracts, and it holds no host API. */
  readonly kernel: boolean;
  /**
   * Its modules are production code. A package that does not ship exists only to test: its modules
   * are test support, coverage does not read them, and its tests run under Playwright, not Vitest.
   */
  readonly ships: boolean;
}

/**
 * A package's role. The words are this union; `ROLES` is typed by it, so `tsc` refuses a word
 * missing from `ROLES` or not in the union. (`isolatedDeclarations` keeps an exported type from
 * being inferred from `ROLES` itself.)
 */
type Role = 'experience' | 'foundation' | 'system' | 'test-infrastructure' | 'view';

/** Every role word with its facts: a word is a key, so it is declared once and carries its own facts. */
const ROLES: Vocabulary<Readonly<Record<Role, RoleFacts>>> = new Vocabulary<Readonly<Record<Role, RoleFacts>>>({
  experience: { kernel: false, ships: true },
  foundation: { kernel: true, ships: true },
  system: { kernel: true, ships: true },
  'test-infrastructure': { kernel: false, ships: false },
  view: { kernel: false, ships: true },
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
 * The facts of a role.
 *
 * @param {Role} role - The role.
 * @returns {RoleFacts} Its facts.
 */
function factsOf(role: Role): RoleFacts {
  return ROLES.of(role);
}

export { factsOf, isRole, ROLE_WORDS };
export type { Role };
