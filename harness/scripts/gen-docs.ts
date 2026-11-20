/**
 * Write the generated blocks of the docs from their owners; with `--check`, compare and write
 * nothing, and exit 1 on a stale block or an unknown block name.
 */

import { run } from '../lib/generated.ts';
import { complain } from '../lib/output.ts';

const left = run(process.argv.includes('--check'));
for (const problem of left) {
  complain(`${problem.path}:${problem.line}: ${problem.message}`);
}
process.exitCode = left.length === 0 ? 0 : 1;
