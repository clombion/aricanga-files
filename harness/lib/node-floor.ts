/**
 * The one owner of the Node floor: `engines.node` in the root `package.json` states the oldest Node
 * the repository runs on (type stripping of `.ts` scripts needs 22.18), as a single `>=x.y.z`.
 */

import { object, parsed } from './config.ts';
import { textOf } from './source-files.ts';

/** A version as major, minor and patch. */
type Version = readonly [number, number, number];

/** A refusal of a version or a floor that is not written the one accepted way. */
class FloorError extends Error {
  public override readonly name = 'FloorError';
}

const EXACT = /^v?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/u;
const FLOOR = /^>=\s*(?<version>\d+\.\d+\.\d+)$/u;

/** The order of a version against its floor at which the floor is met: equal, or anything above. */
const AT_FLOOR = 0;

/**
 * Parse an exact `x.y.z` (a leading `v` allowed).
 *
 * @param {string} text - The version as written.
 * @returns {Version} Its major, minor and patch.
 */
function version(text: string): Version {
  const groups = EXACT.exec(text.trim())?.groups;
  if (groups === undefined) {
    throw new FloorError(`not an exact version: ${JSON.stringify(text)}`);
  }
  return [Number(groups['major']), Number(groups['minor']), Number(groups['patch'])];
}

/**
 * Parse an `engines.node` range; only a single `>=x.y.z` is a floor.
 *
 * @param {string} range - The range as written.
 * @returns {Version} The floor's version.
 */
function floor(range: string): Version {
  const written = FLOOR.exec(range.trim())?.groups?.['version'];
  if (written === undefined) {
    throw new FloorError(`engines.node is not a single >=x.y.z floor: ${JSON.stringify(range)}`);
  }
  return version(written);
}

/**
 * Whether `found` is at or above `minimum`.
 *
 * @param {Version} found - The version found.
 * @param {Version} minimum - The floor.
 * @returns {boolean} Whether it meets the floor.
 */
function meets(found: Version, minimum: Version): boolean {
  const [major, minor, patch] = found;
  const [floorMajor, floorMinor, floorPatch] = minimum;
  return (major - floorMajor || minor - floorMinor || patch - floorPatch) >= AT_FLOOR;
}

/**
 * A manifest's `engines.node` as written.
 *
 * @param {unknown} manifest - The parsed `package.json`.
 * @returns {string | undefined} The range, or undefined when it declares none.
 */
function engineRange(manifest: unknown): string | undefined {
  const engines = object(object(manifest, 'package.json')['engines'] ?? {}, 'engines');
  const { node } = engines;
  if (node !== undefined && typeof node !== 'string') {
    throw new FloorError('engines.node is not a string');
  }
  return node;
}

/**
 * The floor a manifest's `engines.node` states, refused when it states none.
 *
 * @param {unknown} manifest - The parsed `package.json`.
 * @returns {Version} The floor.
 */
function declaredFloor(manifest: unknown): Version {
  const range = engineRange(manifest);
  if (range === undefined) {
    throw new FloorError('package.json declares no engines.node');
  }
  return floor(range);
}

/**
 * The repository's declared floor.
 *
 * @returns {Promise<Version>} The floor `engines.node` states.
 */
async function repoFloor(): Promise<Version> {
  const text = await textOf('package.json');
  return declaredFloor(parsed(text, 'package.json'));
}

/**
 * The Node version the repository pins for its tools (`.node-version`).
 *
 * @returns {Promise<Version>} The pinned version.
 */
async function pinned(): Promise<Version> {
  const text = await textOf('.node-version');
  return version(text);
}

export { declaredFloor, engineRange, floor, FloorError, meets, pinned, repoFloor, version };
