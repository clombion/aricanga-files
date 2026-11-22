/**
 * `pnpm run test:stress [-- --seed N --copies N --repeats N <filters>]`: hunt for flaky tests. Prints
 * the base seed first, then each copy's result, and the command that replays a failing hunt.
 */

import { hunt, huntOf } from '#lib/stress.ts';
import { out } from '#lib/output.ts';
import { stressHunt } from '#lib/script-entries.ts';

/** The arguments before the script's own: the Node binary and the script's path. */
const OWN_ARGUMENTS = 2;

process.exitCode = await stressHunt({ hunt, options: huntOf(process.argv.slice(OWN_ARGUMENTS)), out });
