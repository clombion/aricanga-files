/** A check's scans: opened before its tests, closed after them, read through the returned function. */

import { afterAll, beforeAll } from 'vitest';
import { openScan, scannedFiles } from './checker.ts';
import type { Scan } from './checker.ts';
import { Slot } from './lists.ts';

/** How long opening a scan of the whole repository may take, in milliseconds. */
const OPEN_TIMEOUT_MS = 120_000;

/**
 * Open a scan over `paths`, with `sources` overlaid, for the check's tests.
 *
 * @param {() => readonly string[]} paths - The files to scan.
 * @param {() => Readonly<Record<string, string>>} sources - Texts that replace or add files, by path.
 * @returns {() => Scan} Reads the open scan; throws outside the check's tests.
 */
function useScan(
  paths: () => readonly string[] = scannedFiles,
  sources: () => Readonly<Record<string, string>> = () => ({}),
): () => Scan {
  const opened = new Slot<Scan>();
  beforeAll(() => {
    opened.put(openScan(paths(), sources()));
  }, OPEN_TIMEOUT_MS);

  afterAll(() => {
    opened.take()?.close();
  });
  return () => {
    const scan = opened.peek();
    if (scan === undefined) {
      throw new Error('the scan is read outside the tests that opened it');
    }
    return scan;
  };
}

/**
 * A scan over planted sources for the check's tests.
 *
 * @param {Readonly<ReadonlyMap<string, string>>} plants - Each planted file's text, by path.
 * @returns {() => Scan} Reads the open scan.
 */
function usePlanted(plants: Readonly<ReadonlyMap<string, string>>): () => Scan {
  return useScan(
    () => [...plants.keys()],
    () => Object.fromEntries(plants),
  );
}

export { usePlanted, useScan };
