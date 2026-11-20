/** The host the runtime tests share: it refuses every port a test did not ask for. */

import { heldScheduler, memoryStore } from '#src/testing/host-ports';
import type { Host } from '#src/host/effects';

/**
 * A host that keeps saves in memory and fails the test on a fetch, a present or a timer, unless the
 * test hands its own port for it.
 *
 * @param {Partial<Host>} ports - The ports the test answers itself.
 * @returns {Host} The host.
 */
function refusingHost(ports: Readonly<Partial<Host>> = {}): Host {
  return {
    fetchData: (request) => {
      throw new Error(`no fetch expected: ${JSON.stringify(request)}`);
    },
    present: (effect) => {
      throw new Error(`no present expected: ${effect.kind}`);
    },
    scheduler: heldScheduler(() => {
      throw new Error('no timer expected');
    }),
    store: memoryStore(),
    ...ports,
  };
}

export { refusingHost };
