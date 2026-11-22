/**
 * The pre-push hook: refuse a pushed range holding a `fixup!`, `squash!` or `amend!` commit. It reads
 * the repository it runs in, the one git invoked the hook for.
 */

import { complain, standardInput } from '#lib/output.ts';
import { checkPushed } from '#lib/script-entries.ts';
import { subjectsOf } from '#lib/pushed.ts';

process.exitCode = await checkPushed({ complain, cwd: process.cwd(), stdin: await standardInput(), subjects: subjectsOf });
