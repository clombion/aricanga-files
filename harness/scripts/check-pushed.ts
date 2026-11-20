/**
 * The pre-push hook: refuse a pushed range holding a `fixup!`, `squash!` or `amend!` commit. It reads
 * the repository it runs in, the one git invoked the hook for.
 */

import { complain, exitCode } from '#lib/output.ts';
import { refused, revisions, updates } from '#lib/pushed.ts';
import { finished } from '#lib/tools.ts';
import { isEmpty } from '#lib/lists.ts';
import { text } from 'node:stream/consumers';

/**
 * The refused commits among the pushed ranges.
 *
 * @param {string} pushed - The lines git hands the pre-push hook on standard input.
 * @returns {readonly string[]} The subjects of the refused commits.
 */
function refusedIn(pushed: string): readonly string[] {
  return updates(pushed).flatMap((update) => {
    const log = finished(['git', 'log', '--format=%s', ...revisions(update)], { cwd: process.cwd() });
    return refused(log.stdout.split('\n').filter((subject) => subject !== ''));
  });
}

const found = refusedIn(await text(process.stdin));
if (!isEmpty(found)) {
  complain(`fold these commits before pushing:\n${found.join('\n')}`);
}
process.exitCode = exitCode(isEmpty(found));
