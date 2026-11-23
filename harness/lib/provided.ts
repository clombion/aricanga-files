/**
 * The population the gate's config computes and provides to its workers (`vitest-config.ts`), read
 * where a worker asks for that checkout's population or listing (`scope.ts`, `source-files.ts`), so
 * no worker computes the repository's population or lists it again. Only a Vitest worker has a
 * provided context, told by the global Vitest sets in it; a worker of a run whose config provides no
 * population, or another checkout's, reads none here and its caller computes.
 */

import type { Member, Population } from './scope.ts';

/** The population a run provides, as plain data: its checkout (none for a planted one), listing and members. */
interface ProvidedPopulation {
  readonly root: string | undefined;
  readonly listing: readonly string[];
  readonly members: readonly Member[];
}

declare module 'vitest' {
  interface ProvidedContext {
    /** The population the run's config computed; a config that provides none leaves it absent. */
    readonly population?: ProvidedPopulation;
  }
}

/** The global Vitest sets in its workers, and only there. */
const WORKER_STATE = '__vitest_worker__';

/**
 * The plain data of a population, to provide to a run's workers.
 *
 * @param {Population} held - The population.
 * @returns {ProvidedPopulation} Its checkout, listing and members.
 */
function providedOf(held: Population): ProvidedPopulation {
  return { listing: held.listing, members: held.members, root: held.root };
}

/**
 * The provided population of a checkout: in a Vitest worker whose run provided it for this root;
 * otherwise none, and the caller computes.
 *
 * @param {string} root - The checkout.
 * @param {object} host - The global a worker's state is read from: this process's by default.
 * @returns {Promise<ProvidedPopulation | undefined>} The provided population, or undefined.
 */
async function providedFor(root: string, host: object = globalThis): Promise<ProvidedPopulation | undefined> {
  if (Reflect.get(host, WORKER_STATE) === undefined) {
    return undefined;
  }
  const { inject } = await import('vitest');
  const given = inject('population');
  return given?.root === root ? given : undefined;
}

export { providedFor, providedOf };
