/**
 * Write the generated blocks of the docs from their owners; with `--check`, compare and write
 * nothing, and exit 1 on a stale block or an unknown block name.
 */

import { complain } from '#lib/output.ts';
import { genDocs } from '#lib/script-entries.ts';
import { run } from '#lib/generated.ts';

process.exitCode = await genDocs({ check: process.argv.includes('--check'), complain, run });
