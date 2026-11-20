/** The recorded input streams of the kernel-physics regressions the ledger (regression-ledger.ts) keeps alive. */

import type { FixtureInput } from '@narratives/foundation/testing';
import { story } from '#test/support';

// Recorded Input streams for the kernel-physics regressions. The routing scenario
// is asserted green now; the rest carry the durable repro data, asserted green by
// their consuming physics task.
const FIXTURES: Readonly<Record<string, readonly FixtureInput[]>> = {
  'cross-chat-routing': [
    story('Routes to spectre', ['targetChat: spectre', 'speaker: TonyGov', 'type: received']),
  ],
  'duplicate-notifications': [
    story('First from Maria', ['targetChat: maria', 'speaker: Maria', 'type: received']),
    story('Second from Maria', ['targetChat: maria', 'speaker: Maria', 'type: received']),
  ],
  'receipt-auto-upgrade': [
    story('My question', ['type: sent', 'receipt: delivered']),
    story('Their reply', ['type: received', 'speaker: Pat']),
  ],
  'typing-null-chatid': [
    story('Pat replies from the background', ['targetChat: pat', 'speaker: Pat', 'type: received']),
  ],
};

/**
 * The recorded stream of a named regression; an unknown name fails the test that asked for it.
 *
 * @param {string} name - The fixture's name.
 * @returns {readonly FixtureInput[]} Its recorded stream.
 */
function fixture(name: string): readonly FixtureInput[] {
  const found = FIXTURES[name];
  if (found === undefined) {
    throw new Error(`no regression fixture named ${JSON.stringify(name)}`);
  }
  return found;
}

export { fixture };
