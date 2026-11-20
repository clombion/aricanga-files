/**
 * Write the generated blocks of the docs from their owners; with `--check`, compare and write
 * nothing, and exit 1 on a stale block or an unknown block name.
 */

import { run } from '../lib/generated.ts';

const left = run(process.argv.includes('--check'));
for (const problem of left) {
  process.stderr.write(`${problem.path}:${problem.line}: ${problem.message}\n`);
}
process.exitCode = left.length === 0 ? 0 : 1;
