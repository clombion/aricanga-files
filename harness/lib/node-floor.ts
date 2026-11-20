/**
 * The one owner of the Node floor: `engines.node` in the root `package.json` states the oldest Node
 * the repository runs on (type stripping of `.ts` scripts needs 22.18), as a single `>=x.y.z`.
 */

import { json, object } from './config.ts';
import { textOf } from './source-files.ts';

export type Version = readonly [number, number, number];

export class FloorError extends Error {
  override readonly name = 'FloorError';
}

const EXACT = /^v?(\d+)\.(\d+)\.(\d+)$/;
const FLOOR = /^>=\s*(\d+\.\d+\.\d+)$/;

/** Parse an exact `x.y.z` (a leading `v` allowed). */
export function version(text: string): Version {
  const match = EXACT.exec(text.trim());
  if (match === null) {
    throw new FloorError(`not an exact version: ${JSON.stringify(text)}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Parse an `engines.node` range; only a single `>=x.y.z` is a floor. */
export function floor(range: string): Version {
  const match = FLOOR.exec(range.trim());
  if (match?.[1] === undefined) {
    throw new FloorError(`engines.node is not a single >=x.y.z floor: ${JSON.stringify(range)}`);
  }
  return version(match[1]);
}

/** Whether `found` is at or above `minimum`. */
export function meets(found: Version, minimum: Version): boolean {
  for (const [index, part] of found.entries()) {
    const wanted = minimum[index] ?? 0;
    if (part !== wanted) {
      return part > wanted;
    }
  }
  return true;
}

/** The repository's declared floor. */
export function repoFloor(): Version {
  const engines = object(object(json(textOf('package.json')), 'package.json')['engines'] ?? {}, 'engines');
  if (typeof engines['node'] !== 'string') {
    throw new FloorError('package.json declares no engines.node');
  }
  return floor(engines['node']);
}

/** The Node version the repository pins for its tools (`.node-version`). */
export function pinned(): Version {
  return version(textOf('.node-version'));
}
