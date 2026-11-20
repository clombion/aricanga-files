/** A check's scans: opened before its tests, closed after them, read through the returned function. */

import { afterAll, beforeAll } from 'vitest';

import { openScan, type Scan, scannedFiles } from './checker.ts';

/** Open a scan over `paths` (with `sources` overlaid) for the check's tests; the result reads it. */
export function useScan(
  paths: () => readonly string[] = scannedFiles,
  sources: () => Readonly<Record<string, string>> = () => ({}),
): () => Scan {
  let scan: Scan | undefined;
  beforeAll(() => {
    scan = openScan(paths(), sources());
  }, 120_000);
  afterAll(() => {
    scan?.close();
  });
  return () => {
    if (scan === undefined) {
      throw new Error('the scan is read outside the tests that opened it');
    }
    return scan;
  };
}

/** A scan over planted sources ({path: text}) for the check's tests. */
export function usePlanted(plants: ReadonlyMap<string, string>): () => Scan {
  return useScan(
    () => [...plants.keys()],
    () => Object.fromEntries(plants),
  );
}
