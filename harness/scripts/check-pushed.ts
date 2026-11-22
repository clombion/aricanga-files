/**
 * The pre-push hook: refuse a pushed range holding a `fixup!`, `squash!` or `amend!` commit. It reads
 * the repository it runs in, the one git invoked the hook for.
 */

import { checkPushed } from '#lib/script-entries.ts';
import { complain } from '#lib/output.ts';
import { subjectsOf } from '#lib/pushed.ts';
import { text } from 'node:stream/consumers';

process.exitCode = await checkPushed({ complain, cwd: process.cwd(), stdin: await text(process.stdin), subjects: subjectsOf });
