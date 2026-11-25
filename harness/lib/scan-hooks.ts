/**
 * A check's scans: opened before its tests, closed after them, read through the returned function. A
 * repository scan covers the repository's population; a planted scan covers a population of its plants
 * and the members it declares, never the repository's. A scan's files are its population's
 * (`openScan`), so its files and its population come from one listing.
 */

import { afterAll, beforeAll } from 'vitest';
import { population, populationOf } from './scope.ts';
import type { MemberDir } from './package-dirs.ts';
import type { Population } from './scope.ts';
import type { Role } from './roles.ts';
import type { Scan } from './checker.ts';
import { Slot } from './lists.ts';
import { manifestOf } from './package-dirs.ts';
import { openScan } from './checker.ts';
import { present } from './present.ts';

/** How long opening a scan of the whole repository may take, in milliseconds. */
const OPEN_TIMEOUT_MS = 120_000;

/** A planted member: its directory and the role its manifest declares. */
type PlantedMember = readonly [MemberDir, Role];

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
 * @param {Readonly<ReadonlyMap<string, string>>} plants - Each planted file's text, by path.
 * @param {readonly PlantedMember[]} members - The members the plants sit in.
 * @returns {() => Scan} Reads the open scan.
 */
function usePlanted(plants: Readonly<ReadonlyMap<string, string>>, members: readonly PlantedMember[]): () => Scan {
  return scanFor(async () => {
    const found = await plantedPopulation([...plants.keys()], members);
    return found;
  }, Object.fromEntries(plants));
}

export { plantedPopulation, usePlanted, useScan };
export type { PlantedMember };
