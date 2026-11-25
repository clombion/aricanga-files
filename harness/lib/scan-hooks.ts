/**
 * A check's scans and planted populations. A scan is opened before its tests, closed after them,
 * and read through the returned function. A repository scan covers the repository's population; a
 * planted scan covers a population of its plants and the members it declares, never the
 * repository's. A scan's files are its population's (`openScan`), so its files and its population
 * come from one listing. A planted population is built by the rule a checkout's is
 * (`populationOf`), the root's manifest read with its members', and refuses what production never
 * holds: a member or a plant given twice, a plant no member or the harness holds, a plant at a
 * member's manifest, a declared member the population leaves out (a POC directory).
 */

import { Slot, isEmpty } from './lists.ts';
import { afterAll, beforeAll } from 'vitest';
import { population, populationOf } from './scope.ts';
import type { Fields } from './manifests.ts';
import type { MemberDir } from './package-dirs.ts';
import type { Population } from './scope.ts';
import { PopulationError } from './workspace.ts';
import type { Role } from './roles.ts';
import type { Scan } from './checker.ts';
import { manifestOf } from './package-dirs.ts';
import { openScan } from './checker.ts';
import { present } from './present.ts';

/** How long opening a scan of the whole repository may take, in milliseconds. */
const OPEN_TIMEOUT_MS = 120_000;

/** A planted member: its directory, the role its manifest declares, and the other fields its manifest holds. */
type PlantedMember = readonly [MemberDir, Role, Fields?];

/**
 * The entries of a list declared more than once, by their key, each named once.
 *
 * @param {readonly string[]} keys - The keys, in the order given.
 * @returns {readonly string[]} Each key given twice or more.
 */
function declaredTwice(keys: readonly string[]): readonly string[] {
  return [...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))];
}

/**
 * The population of planted files and planted members: each member's manifest is listed, declares
 * its role, and is a workspace package; the root's manifest is read with them; there is no
 * checkout. The members and the plants are lists of entries, so a directory or a path given twice
 * reaches here however the list was built (a literal, a spread, `Object.fromEntries` would each
 * have collapsed it), and every state production never builds is refused at once, each named.
 *
 * @param {readonly string[]} files - The planted files besides the manifests.
 * @param {readonly PlantedMember[]} members - The planted members.
 * @param {Fields} root - The root manifest's fields; none by default.
 * @returns {Promise<Population>} The planted population.
 */
async function plantedPopulation(files: readonly string[], members: readonly PlantedMember[], root: Fields = {}): Promise<Population> {
  const manifests = new Map([
    ...members.map(([dir, role, fields = {}]) => [manifestOf(dir), JSON.stringify({ ...fields, aricanga: { role } })] as const),
    [manifestOf(''), JSON.stringify(root)] as const,
  ]);
  const found = await populationOf({
    listing: [...files, ...manifests.keys()],
    read: async (listed: string): Promise<string> => {
      const text = await Promise.resolve(present(manifests.get(listed), `the planted manifest ${listed}`));
      return text;
    },
    workspace: members.map(([dir]) => dir),
  });
  const refused = [
    ...declaredTwice(members.map(([dir]) => dir)).map((dir) => `${dir} is declared twice`),
    ...declaredTwice(files).map((planted) => `${planted} is planted twice`),
    ...files.filter((planted) => manifests.has(planted)).map((planted) => `${planted} is a planted manifest`),
    ...members.filter(([dir]) => !found.members.some((member) => member.dir === dir)).map(([dir]) => `${dir} is declared and is no member`),
    ...files.filter((planted) => !found.holds(planted)).map((planted) => `${planted} is held by no planted member or the harness`),
  ];
  if (!isEmpty(refused)) {
    throw new PopulationError(`a planted population refused: ${refused.join('; ')}`);
  }
  return found;
}

/**
 * Open a scan over a population, with `sources` overlaid, for the check's tests.
 *
 * @param {() => Promise<Population>} held - The population the scan covers.
 * @param {Readonly<Record<string, string>>} sources - Texts that replace or add files, by path.
 * @returns {() => Scan} Reads the open scan; throws outside the check's tests.
 */
function scanFor(held: () => Promise<Population>, sources: Readonly<Record<string, string>>): () => Scan {
  const opened = new Slot<Scan>();
  beforeAll(async () => {
    const found = await held();
    opened.put(openScan(found, sources));
  }, OPEN_TIMEOUT_MS);

  afterAll(() => {
    opened.take()?.close();
  });
  return () => present(opened.peek(), 'the scan, read outside the tests that opened it,');
}

/**
 * A scan of the repository for the check's tests.
 *
 * @returns {() => Scan} Reads the open scan.
 */
function useScan(): () => Scan {
  return scanFor(population, {});
}

/**
 * A scan over planted sources for the check's tests, covering the plants' own population.
 *
 * @param {readonly (readonly [string, string])[]} plants - Each planted file's path and text; a path given twice is refused.
 * @param {readonly PlantedMember[]} members - The members the plants sit in.
 * @returns {() => Scan} Reads the open scan.
 */
function usePlanted(plants: readonly (readonly [string, string])[], members: readonly PlantedMember[]): () => Scan {
  return scanFor(async () => {
    const found = await plantedPopulation(
      plants.map(([path]) => path),
      members,
    );
    return found;
  }, Object.fromEntries(plants));
}

export { plantedPopulation, usePlanted, useScan };
export type { PlantedMember };
