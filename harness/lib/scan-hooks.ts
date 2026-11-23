/**
 * A check's scans: opened before its tests, closed after them, read through the returned function. A
 * repository scan reads the repository's population; a planted scan reads a population of its plants
 * and the members it declares, never the repository's, so production's pairing holds: a scan's files
 * and its population come from one listing.
 */

import { afterAll, beforeAll } from 'vitest';
import { openScan, scannedFiles } from './checker.ts';
import { population, populationOf } from './scope.ts';
import type { MemberDir } from './package-dirs.ts';
import type { Population } from './scope.ts';
import type { Role } from './roles.ts';
import type { Scan } from './checker.ts';
import { Slot } from './lists.ts';
import { manifestOf } from './package-dirs.ts';
import { present } from './present.ts';

/** How long opening a scan of the whole repository may take, in milliseconds. */
const OPEN_TIMEOUT_MS = 120_000;

/** A planted member: its directory and the role its manifest declares. */
type PlantedMember = readonly [MemberDir, Role];

/**
 * Open a scan over `paths`, with `sources` overlaid, reading roles from `held`, for the check's tests.
 *
 * @param {() => Promise<readonly string[]>} paths - The files to scan.
 * @param {() => Readonly<Record<string, string>>} sources - Texts that replace or add files, by path.
 * @param {() => Promise<Population>} held - The population the scan reads roles from.
 * @returns {() => Scan} Reads the open scan; throws outside the check's tests.
 */
function useScan(
  paths: () => Promise<readonly string[]> = scannedFiles,
  sources: () => Readonly<Record<string, string>> = () => ({}),
  held: () => Promise<Population> = population,
): () => Scan {
  const opened = new Slot<Scan>();
  beforeAll(async () => {
    const [files, found] = await Promise.all([paths(), held()]);
    opened.put(openScan(files, sources(), found));
  }, OPEN_TIMEOUT_MS);

  afterAll(() => {
    opened.take()?.close();
  });
  return () => present(opened.peek(), 'the scan, read outside the tests that opened it,');
}

/**
 * The population of planted files and planted members: each member's manifest declares its role.
 *
 * @param {readonly string[]} files - The planted files.
 * @param {readonly PlantedMember[]} members - The planted members.
 * @returns {Promise<Population>} The planted population.
 */
async function plantedPopulation(files: readonly string[], members: readonly PlantedMember[]): Promise<Population> {
  const manifests = new Map(
    members.map(([dir, role]: PlantedMember) => [manifestOf(dir), JSON.stringify({ aricanga: { role } })] as const),
  );
  const found = await populationOf({
    listing: [...files, ...manifests.keys()],
    read: async (listed: string): Promise<string> => {
      const text = await Promise.resolve(present(manifests.get(listed), `the planted manifest ${listed}`));
      return text;
    },
    workspace: members.map(([dir]: PlantedMember) => dir),
  });
  return found;
}

/**
 * A scan over planted sources for the check's tests, reading roles from the plants' own population.
 *
 * @param {Readonly<ReadonlyMap<string, string>>} plants - Each planted file's text, by path.
 * @param {readonly PlantedMember[]} members - The members the plants sit in; a plant in no member declares none.
 * @returns {() => Scan} Reads the open scan.
 */
function usePlanted(plants: Readonly<ReadonlyMap<string, string>>, members: readonly PlantedMember[]): () => Scan {
  return useScan(
    async () => {
      const files = await Promise.resolve([...plants.keys()]);
      return files;
    },
    () => Object.fromEntries(plants),
    async () => {
      const found = await plantedPopulation([...plants.keys()], members);
      return found;
    },
  );
}

export { usePlanted, useScan };
