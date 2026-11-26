/**
 * The population of planted files and planted members, built by the rule a checkout's is
 * (`populationOf`): each member's manifest is listed, declares its role, and is a workspace package
 * named by its manifest's `name`, read by pnpm's listing's rule (`packageName`);
 * the root's manifest is read with them; there is no checkout. The members and the plants are lists
 * of entries, so a directory or a path given twice reaches here however the list was built (a
 * literal, a spread or `Object.fromEntries` would each have collapsed it), and every state production
 * never builds is refused at once, each named: a member or a plant given twice, a member's fields
 * holding `aricanga` (its role is the planted one), a plant no member or the harness holds, a plant
 * at a planted manifest, a declared member the population leaves out (a POC directory). A role that
 * is no role (a value widened past `Role`), and a name that is no string, are refused by the
 * population's own rule: alone, by the population's own refusal, its class and text as
 * `populationOf` throws them; beside a state of the lists, which are read before the population is
 * built, in the one refusal naming those states. The
 * states that need the population (a member it leaves out, a plant it holds nowhere) are named when
 * it builds. Fields that are no object (`null`, widened past `Fields`) are held by the types alone:
 * the check of their `aricanga` throws a `TypeError` on them.
 */

import { PopulationError, nameRefusal, packageName } from './workspace.ts';
import type { Fields } from './manifests.ts';
import type { MemberDir } from './package-dirs.ts';
import type { Population } from './scope.ts';
import type { Role } from './roles.ts';
import type { WorkspacePackage } from './workspace.ts';
import { isEmpty } from './lists.ts';
import { manifestOf } from './package-dirs.ts';
import { populationOf } from './scope.ts';
import { present } from './present.ts';

/** A list of one. */
const ONE = 1;

/** A planted member: its directory, the role its manifest declares, and the other fields its manifest holds. */
type PlantedMember = readonly [MemberDir, Role, Fields?];

/** A planted member as declared, its fields none when it gives none. */
interface Declared {
  readonly dir: MemberDir;
  readonly role: Role;
  readonly fields: Fields;
}

/**
 * The keys of a list given more than once, each named once.
 *
 * @param {readonly string[]} keys - The keys, in the order given.
 * @returns {readonly string[]} Each key given twice or more.
 */
function givenTwice(keys: readonly string[]): readonly string[] {
  return [...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))];
}

/**
 * The refusals the planted lists show before any population is built: a member or a plant given
 * twice, fields holding `aricanga`, a plant at a planted manifest.
 *
 * @param {readonly Declared[]} declared - The planted members.
 * @param {readonly string[]} files - The planted files besides the manifests.
 * @param {ReadonlyMap<string, string>} texts - The planted manifests' texts, by path.
 * @returns {readonly string[]} Each refusal's line.
 */
function givenRefusals(declared: readonly Declared[], files: readonly string[], texts: ReadonlyMap<string, string>): readonly string[] {
  return [
    ...givenTwice(declared.map(({ dir }) => dir)).map((dir) => `${dir} is declared twice`),
    ...givenTwice(files).map((planted) => `${planted} is planted twice`),
    ...declared.filter(({ fields }) => Object.hasOwn(fields, 'aricanga')).map(({ dir }) => `${dir}'s fields hold aricanga`),
    ...files.filter((planted) => texts.has(planted)).map((planted) => `${planted} is a planted manifest`),
  ];
}

/**
 * A planted member's package name, read from the `name` its fields hold by the rule pnpm's listing is
 * read by (`packageName`): a string, none, or the refusal of a name that is no string.
 *
 * @param {Declared} member - The planted member.
 * @returns {string | undefined} The name.
 */
function nameOf(member: Declared): string | undefined {
  return packageName(member.fields['name'], manifestOf(member.dir));
}

/**
 * The reader of the planted manifests' texts; a path it holds no text for is refused.
 *
 * @param {ReadonlyMap<string, string>} texts - The planted manifests' texts, by path.
 * @returns {(listed: string) => Promise<string>} The reader.
 */
function readerOf(texts: ReadonlyMap<string, string>): (listed: string) => Promise<string> {
  return async (listed: string): Promise<string> => {
    const text = await Promise.resolve(present(texts.get(listed), `the planted manifest ${listed}`));
    return text;
  };
}

/**
 * The refusal of a planted population whose lists are refused and whose population refused too: one
 * refusal naming the lists' states and the population's.
 *
 * @param {readonly string[]} given - The lists' refusals.
 * @param {unknown} reason - The population's refusal.
 * @returns {never} Nothing: it throws.
 */
function refusedBeside(given: readonly string[], reason: unknown): never {
  throw new PopulationError('planted', `a planted population refused: ${[...given, String(reason)].join('; ')}`, { cause: reason });
}

/**
 * The planted members' workspace packages, each named by `nameOf`; a name that is no string is
 * refused by the population's own refusal, alone, or beside the lists' states in one refusal naming
 * them all.
 *
 * @param {readonly Declared[]} declared - The planted members.
 * @param {readonly string[]} given - The lists' refusals.
 * @returns {readonly WorkspacePackage[]} The packages.
 */
function workspaceOf(declared: readonly Declared[], given: readonly string[]): readonly WorkspacePackage[] {
  const refusals = declared.flatMap((member) => {
    const refusal = nameRefusal(member.fields['name'], manifestOf(member.dir));
    return refusal === undefined ? [] : [refusal];
  });
  const [first] = refusals;
  if (first !== undefined) {
    if (isEmpty(given) && refusals.length === ONE) {
      throw first;
    }
    throw new PopulationError('planted', `a planted population refused: ${[...given, ...refusals.map(String)].join('; ')}`, {
      cause: new AggregateError(refusals, 'each name refused'),
    });
  }
  return declared.map((member) => ({ dir: member.dir, name: nameOf(member) }));
}

/**
 * The refusals that need the built population: a declared member it leaves out, a plant it holds nowhere.
 *
 * @param {Population} built - The population.
 * @param {readonly Declared[]} declared - The planted members.
 * @param {readonly string[]} files - The planted files besides the manifests.
 * @returns {readonly string[]} Each refusal's line.
 */
function builtRefusals(built: Population, declared: readonly Declared[], files: readonly string[]): readonly string[] {
  return [
    ...declared
      .filter(({ dir }) => !built.members.some((member) => member.dir === dir))
      .map(({ dir }) => `${dir} is declared and is no member`),
    ...files.filter((planted) => !built.holds(planted)).map((planted) => `${planted} is held by no planted member or the harness`),
  ];
}

/**
 * Refuse a planted population, naming each of its refusals; nothing when there are none.
 *
 * @param {readonly string[]} refused - Each refusal's line.
 */
function refuseAny(refused: readonly string[]): void {
  if (!isEmpty(refused)) {
    throw new PopulationError('planted', `a planted population refused: ${refused.join('; ')}`);
  }
}

/**
 * The planted population.
 *
 * @param {readonly string[]} files - The planted files besides the manifests.
 * @param {readonly PlantedMember[]} members - The planted members.
 * @param {Fields} root - The root manifest's fields; none by default.
 * @returns {Promise<Population>} The planted population.
 */
async function plantedPopulation(files: readonly string[], members: readonly PlantedMember[], root: Fields = {}): Promise<Population> {
  const declared = members.map(([dir, role, fields = {}]): Declared => ({ dir, fields, role }));
  const texts = new Map([
    ...declared.map(({ dir, fields, role }) => [manifestOf(dir), JSON.stringify({ ...fields, aricanga: { role } })] as const),
    [manifestOf(''), JSON.stringify(root)] as const,
  ]);
  const given = givenRefusals(declared, files, texts);
  const building = populationOf({
    listing: [...files, ...texts.keys()],
    read: readerOf(texts),
    workspace: workspaceOf(declared, given),
  });
  const [built] = await Promise.allSettled([building]);
  if (built.status === 'rejected') {
    return isEmpty(given) ? building : refusedBeside(given, built.reason);
  }
  refuseAny([...given, ...builtRefusals(built.value, declared, files)]);
  return built.value;
}

export { plantedPopulation };
export type { PlantedMember };
