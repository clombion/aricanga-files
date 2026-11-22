/** A check's scans: opened before its tests, closed after them, read through the returned function. */

import { afterAll, beforeAll } from 'vitest';
import { openScan, scannedFiles } from './checker.ts';
import type { Scan } from './checker.ts';
import { Slot } from './lists.ts';
import { present } from './present.ts';

/** How long opening a scan of the whole repository may take, in milliseconds. */
const OPEN_TIMEOUT_MS = 120_000;

/**
 * Open a scan over `paths`, with `sources` overlaid, for the check's tests.
 *
 * @param {() => Promise<readonly string[]>} paths - The files to scan.
 * @param {() => Readonly<Record<string, string>>} sources - Texts that replace or add files, by path.
 * @returns {() => Scan} Reads the open scan; throws outside the check's tests.
 */
function useScan(
  paths: () => Promise<readonly string[]> = scannedFiles,
  sources: () => Readonly<Record<string, string>> = () => ({}),
): () => Scan {
  const opened = new Slot<Scan>();
  beforeAll(async () => {
    const files = await paths();
    opened.put(openScan(files, sources()));
  }, OPEN_TIMEOUT_MS);

  afterAll(() => {
    opened.take()?.close();
  });
  return () => present(opened.peek(), 'the scan, read outside the tests that opened it,');
}

/**
 * A scan over planted sources for the check's tests.
 *
 * @param {Readonly<ReadonlyMap<string, string>>} plants - Each planted file's text, by path.
 * @returns {() => Scan} Reads the open scan.
 */
function usePlanted(plants: Readonly<ReadonlyMap<string, string>>): () => Scan {
  return useScan(
    async () => {
      const files = await Promise.resolve([...plants.keys()]);
      return files;
    },
    () => Object.fromEntries(plants),
  );
}

export { usePlanted, useScan };
