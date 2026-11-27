/**
 * Whose code a held path is: its nearest member's, or else the harness's, which holds its own
 * directory (`HARNESS_ROOT`) and the root configuration modules (`ROOT_MODULES`). The population
 * builds its `holderOf` here (`scope.ts`), and every reader of "whose code" asks that, or the
 * harness's modules it selects (`harnessModules`).
 */

import { Accepted } from '#lint-rules/exemptions.ts';
import type { MemberDir } from './package-dirs.ts';
import type { Population } from './scope.ts';
import { PopulationError } from './workspace.ts';
import { ROOT_MODULES } from './config-modules.ts';
import { isEmpty } from './lists.ts';
import { isTypeScript } from './source-files.ts';
import { nearestOf } from './package-dirs.ts';

/** The harness's own directory: held, and not a workspace package; its files are the harness's. */
const HARNESS_ROOT: MemberDir = 'harness/';

/** The root modules the harness holds: its configuration modules, its code wherever they sit. */
const HARNESS_MODULES = new Accepted<string>(ROOT_MODULES);

/** A holder that is a member: anything with a member's directory. */
interface Directed {
  readonly dir: MemberDir;
}

/**
 * Whose code each path is, over a population's members: the nearest member holding it, else the
 * harness for a path under its directory or a root configuration module. A member at the harness's
 * directory is refused, since its files would be its own and the harness's; a member nested in
 * another gives its files to the nearest one, and so does a member under the harness's directory,
 * nested in the harness (#58 1c refuses nesting, the harness as the outer holder included).
 *
 * @param {readonly Member[]} members - The members.
 * @returns {(path: string) => Member | 'harness' | undefined} The holder of a path; none for a path no holder holds.
 */
function holderIn<Member extends Directed>(members: readonly Member[]): (path: string) => Member | 'harness' | undefined {
  const twice = members.filter((member) => member.dir === HARNESS_ROOT);
  if (!isEmpty(twice)) {
    throw new PopulationError('root', `a member sits at the harness's root, ${HARNESS_ROOT}: its files would be its own and the harness's`);
  }
  const nearest = nearestOf(members, (member) => member.dir);
  return (path: string): Member | 'harness' | undefined =>
    nearest(path) ?? (path.startsWith(HARNESS_ROOT) || HARNESS_MODULES.has(path) ? 'harness' : undefined);
}

/**
 * A holder's directory: a member's own, or the harness's.
 *
 * @param {Directed | 'harness'} holder - The holder.
 * @returns {MemberDir} Its directory.
 */
function heldDir(holder: Readonly<Directed> | 'harness'): MemberDir {
  return holder === 'harness' ? HARNESS_ROOT : holder.dir;
}

/**
 * The harness's modules: the held TypeScript modules whose holder is the harness (`holderOf`), those
 * under `harness/` and the root configuration modules.
 *
 * @param {Population} held - The population.
 * @returns {readonly string[]} The modules, in listing order.
 */
function harnessModules(held: Population): readonly string[] {
  return held.listing.filter((file) => isTypeScript(file) && held.holderOf(file) === 'harness');
}

export { HARNESS_ROOT, harnessModules, heldDir, holderIn };
