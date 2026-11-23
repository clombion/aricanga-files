/** The `json-files` check's reading of a package manifest: a dependency listed twice across the groups that conflict. */

import { list, object, stringOf } from '#lib/config.ts';

/** The pairs of dependency groups a package may not appear in both of, as npm and pnpm resolve them. */
const CONFLICTS: readonly (readonly [string, string])[] = [
  ['dependencies', 'devDependencies'],
  ['dependencies', 'optionalDependencies'],
  ['dependencies', 'peerDependencies'],
  ['optionalDependencies', 'peerDependencies'],
];

/** The groups a manifest lists as arrays of names; each must name a package once. */
const BUNDLED: readonly string[] = ['bundleDependencies', 'bundledDependencies'];

/**
 * The names a manifest's dependency group lists.
 *
 * @param {Readonly<Record<string, unknown>>} manifest - The manifest.
 * @param {string} group - The group.
 * @returns {ReadonlySet<string>} The names it lists.
 */
function namesIn(manifest: Readonly<Record<string, unknown>>, group: string): ReadonlySet<string> {
  const listed = Object.hasOwn(manifest, group) ? manifest[group] : undefined;
  return new Set(listed === undefined ? [] : Object.keys(object(listed, group)));
}

/**
 * The packages a manifest lists twice: in two groups that conflict, or twice in a bundled list.
 * A package listed twice in one object group is a key written twice, which the JSON reader finds.
 *
 * @param {unknown} parsed - The manifest, parsed.
 * @returns {readonly string[]} One problem per package listed twice.
 */
function duplicateDependencies(parsed: unknown): readonly string[] {
  const manifest = object(parsed, 'package.json');
  const across = CONFLICTS.flatMap(([first, second]) => {
    const firstNames = namesIn(manifest, first);
    return [...namesIn(manifest, second)].filter((name) => firstNames.has(name)).map((name) => `${name} is in both ${first} and ${second}`);
  });
  const bundled = BUNDLED.flatMap((group) => {
    const listed: unknown = Object.hasOwn(manifest, group) ? manifest[group] : [];
    const names = list(listed, `package.json ${group}`).map((name) => stringOf(name, `a name of package.json ${group}`));
    return names.filter((name, index) => names.indexOf(name) !== index).map((name) => `${name} is listed twice in ${group}`);
  });
  return [...across, ...bundled];
}

export { duplicateDependencies };
