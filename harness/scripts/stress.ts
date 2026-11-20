/**
 * `pnpm run test:stress [-- --seed N --copies N --repeats N <filters>]`: hunt for flaky tests. Prints
 * the base seed first, then each copy's result, and the command that replays a failing hunt.
 */

import { exitCode, out, succeeded } from '#lib/output.ts';
import { hunt, huntOf } from '#lib/stress.ts';
import { isEmpty } from '#lib/lists.ts';

/** The arguments before the script's own: the Node binary and the script's path. */
const OWN_ARGUMENTS = 2;

/**
 * Hunt with the given options, reporting each failing copy and the replay command.
 *
 * @param {readonly string[]} argv - The script's own arguments.
 * @returns {Promise<number>} The script's exit code.
 */
async function main(argv: readonly string[]): Promise<number> {
  const options = huntOf(argv);
  out(`test:stress: base seed ${options.seed}, ${options.copies} copies, ${options.repeats} repeats\n`);
  const results = await hunt(options);
  const failed = results.filter((result) => !succeeded(result));
  for (const result of failed) {
    out(`seed ${result.seed} failed:\n${result.output}\n`);
  }
  out(`test:stress: ${results.length - failed.length} of ${results.length} copies passed\n`);
  if (!isEmpty(failed)) {
    out(`replay: pnpm run test:stress -- --seed ${options.seed} --copies ${options.copies} --repeats ${options.repeats}\n`);
  }
  return exitCode(isEmpty(failed));
}

process.exitCode = await main(process.argv.slice(OWN_ARGUMENTS));
