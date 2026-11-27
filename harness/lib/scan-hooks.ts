/**
 * A check's scans: opened before its tests, closed after them, read through the returned function. A
 * repository scan covers the repository's population; a planted scan covers a population of its plants
 * and the members it declares (`planted-population.ts`), never the repository's. A scan's files are its
 * population's (`openScan`), so its files and its population come from one listing.
 */

import { afterAll, beforeAll } from 'vitest';
import type { PlantedMember } from './planted-population.ts';
import type { Population } from './scope.ts';
import type { Scan } from './checker.ts';
import { Slot } from './lists.ts';
import { openScan } from './checker.ts';
import { plantedPopulation } from './planted-population.ts';
import { population } from './scope.ts';
import { present } from './present.ts';

/** How long opening a scan of the whole repository may take, in milliseconds. */
const OPEN_TIMEOUT_MS = 120_000;

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
 * @param {readonly (readonly [string, string])[]} mounted - Files the scan serves that the population does not hold (an installed package, a member's manifest), by path.
 * @returns {() => Scan} Reads the open scan.
 */
function usePlanted(
  plants: readonly (readonly [string, string])[],
  members: readonly PlantedMember[],
  mounted: readonly (readonly [string, string])[] = [],
): () => Scan {
  return scanFor(
    async () => {
      const found = await plantedPopulation(
        plants.map(([path]) => path),
        members,
      );
      return found;
    },
    Object.fromEntries([...mounted, ...plants]),
  );
}

export { usePlanted, useScan };
