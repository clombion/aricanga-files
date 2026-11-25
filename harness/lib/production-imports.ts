/**
 * The whole-chain half of the import boundaries (card C of audit js261125, the user's decision): a
 * production module imports no non-production module (`isProduction`), by any form, within its
 * member or across members, the harness's production modules included. By induction, nothing a
 * production module reaches is test support or test infrastructure. It reads the scan's resolved
 * imports (`imports-of.ts`), so a relative path, a `#` alias and an exported `./testing` subpath are
 * one case. It rests on `typescript/unstable/*`, and tracks it across 7.x.
 */

import { isProduction, sourceOf } from './checker.ts';
import type { Scan } from './checker.ts';
import { importedModules } from './imports-of.ts';

/** An import of a non-production module by a production one. */
interface Edge {
  readonly from: string;
  readonly to: string;
}

/**
 * Every import of a non-production module the scan's production modules make.
 *
 * @param {Scan} scan - The open scan.
 * @returns {readonly Edge[]} The edges, by importer, then in the order each names them.
 */
function productionImports(scan: Scan): readonly Edge[] {
  const held = scan.population;
  return scan.paths
    .filter((from) => isProduction(held, from))
    .flatMap((from) =>
      importedModules(scan, sourceOf(scan, from))
        .filter((to) => held.holds(to) && !isProduction(held, to))
        .map((to) => ({ from, to })),
    );
}

export { productionImports };
