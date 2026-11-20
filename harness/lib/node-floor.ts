/**
 * The one owner of the Node floor: `engines.node` in the root `package.json` states the oldest Node
 * the repository runs on (type stripping of `.ts` scripts needs 22.18), as a single `>=x.y.z`.
 */

import { json, object } from './config.ts';
import { textOf } from './source-files.ts';

/** A version as major, minor and patch. */
type Version = readonly [number, number, number];

/** A refusal of a version or a floor that is not written the one accepted way. */
class FloorError extends Error {
  public override readonly name = 'FloorError';
}

const EXACT = /^v?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/u;
const FLOOR = /^>=\s*(?<version>\d+\.\d+\.\d+)$/u;

/** The value a missing part of a version stands for. */
const MISSING_PART = 0;

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
  const differing = found.findIndex((part, index) => part !== (minimum[index] ?? MISSING_PART));
  const part = found[differing];
  return part === undefined || part > (minimum[differing] ?? MISSING_PART);
}

/**
 * A manifest's `engines.node` as written.
 *
 * @param {unknown} manifest - The parsed `package.json`.
 * @returns {string} The range, or `''` when it declares none.
 */
function engineRange(manifest: unknown): string {
  const engines = object(object(manifest, 'package.json')['engines'] ?? {}, 'engines');
  const node = engines['node'] ?? '';
  if (typeof node !== 'string') {
    throw new FloorError('engines.node is not a string');
  }
  return node;
}

/**
 * The repository's declared floor.
 *
 * @returns {Version} The floor `engines.node` states.
 */
function repoFloor(): Version {
  const range = engineRange(json(textOf('package.json')));
  if (range === '') {
    throw new FloorError('package.json declares no engines.node');
  }
  return floor(range);
}

/**
 * The Node version the repository pins for its tools (`.node-version`).
 *
 * @returns {Version} The pinned version.
 */
function pinned(): Version {
  return version(textOf('.node-version'));
}

export { engineRange, floor, FloorError, meets, pinned, repoFloor, version };
export type { Version };
