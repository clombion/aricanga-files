/**
 * The pre-push hook: refuse a pushed range holding a `fixup!`, `squash!` or `amend!` commit. It reads
 * the repository it runs in, the one git invoked the hook for.
 */

import { readFileSync } from 'node:fs';

import { complain } from '../lib/output.ts';
import { refused, revisions, updates } from '../lib/pushed.ts';
import { finished } from '../lib/tools.ts';

const found = updates(readFileSync(0, 'utf8')).flatMap((update) => {
  const log = finished(['git', 'log', '--format=%s', ...revisions(update)], { cwd: process.cwd() });
  return refused(log.stdout.split('\n').filter((subject) => subject !== ''));
});
if (found.length > 0) {
  complain(`fold these commits before pushing:\n${found.join('\n')}`);
}
process.exitCode = found.length === 0 ? 0 : 1;
