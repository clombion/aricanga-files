/**
 * Write the generated blocks of the docs from their owners; with `--check`, compare and write
 * nothing, and exit 1 on a stale block or an unknown block name.
 */

import { complain, exitCode } from '#lib/output.ts';
import { isEmpty } from '#lib/lists.ts';
import { run } from '#lib/generated.ts';

/**
 * Write or compare the generated blocks, complaining of each one left stale.
 *
 * @returns {number} The script's exit code.
 */
function main(): number {
  const left = run(process.argv.includes('--check'));
  for (const problem of left) {
    complain(`${problem.path}:${problem.line}: ${problem.message}`);
  }
  return exitCode(isEmpty(left));
}

process.exitCode = main();
